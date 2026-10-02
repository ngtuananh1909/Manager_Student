const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const db = require('./db.cjs');
const { AuthError, createAuthService, hashPassword, safeUser } = require('./auth.cjs');
const { ContestPolicyError, assertJoinAllowed, assertSubmissionAllowed } = require('./contestPolicy.cjs');
const { compareVersions, verifyUpdateArtifact } = require('./updateSecurity.cjs');
const {
  sanitizeContestForHost,
  sanitizeContestForStudent,
  sanitizeProblemForHost,
  sanitizeProblemForStudent,
  sanitizeSubmissionForStudent
} = require('./serializers.cjs');
const judge = require('./judge.cjs');
const queue = require('./queue.cjs');
const lan = require('./lanDiscovery.cjs');
const antiCheat = require('./antiCheat.cjs');
const mammoth = require('mammoth');

// Read version from package.json dynamically
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
})();

const uploadsDir = path.join(db.DATA_DIR || process.cwd(), 'uploads', 'pdfs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const auth = createAuthService(db);
const requireHost = auth.requireRole('host');
app.use((req, res, next) => {
  if (req.url && req.url.includes('//')) {
    req.url = req.url.replace(/\/{2,}/g, '/');
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Handle JSON body parse errors (e.g. payload too large) gracefully
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      error: 'Dung lượng dữ liệu gửi lên quá lớn (vượt quá giới hạn 500MB). Vui lòng kiểm tra lại kích thước các file test case hoặc file đề thi.'
    });
  }
  next(err);
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB socket buffer
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

queue.setSocketIO(io);

// Rate limiting & Brute-force protection stores
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const submissionTimestamps = new Map(); // ip/userId -> lastTimestamp

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.lockedUntil && record.lockedUntil > now) {
    const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
    return res.status(429).json({ 
      error: `Quá nhiều lần đăng nhập thất bại. IP tạm thời bị khóa. Vui lòng thử lại sau ${remainingSecs} giây.` 
    });
  }
  next();
}

function submissionRateLimiter(req, res, next) {
  const key = req.user?.id || req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const lastTime = submissionTimestamps.get(key) || 0;
  if (now - lastTime < 2000) { // Max 1 submission every 2 seconds
    return res.status(429).json({ error: 'Bạn đang nộp bài quá nhanh. Vui lòng đợi 2 giây trước lần nộp tiếp theo.' });
  }
  submissionTimestamps.set(key, now);
  next();
}

// Online User & Socket Tracking
const onlineUsers = new Map(); // socketId -> { socketId, userId, username, fullName, role, ip, lastSeen }

io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token || '');
  const user = auth.resolveAccessToken(token);
  if (!user) return next(new Error('AUTH_REQUIRED'));
  socket.data.user = user;
  socket.data.accessToken = token;
  next();
});

// Socket.IO real-time events
io.on('connection', (socket) => {
  const clientIp = String(socket.handshake.address || '').replace(/^::ffff:/, '');
  const user = socket.data.user;

  socket.join(`user:${user.id}`);
  socket.join(`role:${user.role}`);
  onlineUsers.set(socket.id, {
    socketId: socket.id,
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    ip: clientIp || '127.0.0.1',
    lastSeen: Date.now()
  });
  io.to('role:host').emit('users:online_update', Array.from(onlineUsers.values()));

  socket.emit('queue:status', {
    queueLength: queue.queue.length,
    activeWorkers: queue.activeWorkers
  });

  socket.on('disconnect', () => {
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      io.to('role:host').emit('users:online_update', Array.from(onlineUsers.values()));
    }
  });
});

// PING / HEARTBEAT
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'online',
    serverName: db.getSettings().serverName,
    isFirstRun: db.isFirstRun(),
    time: Date.now(),
    version: APP_VERSION
  });
});

// FIRST RUN STATUS & SETUP
app.get('/api/system/status', (req, res) => {
  res.json({
    isFirstRun: db.isFirstRun(),
    serverName: db.getSettings().serverName,
    globalMemoryLimit: db.getSettings().globalMemoryLimit || 256,
    version: APP_VERSION
  });
});

function isLoopbackRequest(req) {
  const address = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

function handleAuthFailure(res, error) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  console.error('[Auth Error]', error);
  return res.status(500).json({ code: 'AUTH_INTERNAL_ERROR', error: 'Không thể xử lý yêu cầu xác thực.' });
}

function handlePolicyFailure(res, error) {
  if (error instanceof ContestPolicyError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  console.error('[Contest Policy Error]', error);
  return res.status(500).json({ code: 'CONTEST_POLICY_ERROR', error: 'Không thể kiểm tra điều kiện kỳ thi.' });
}

function getBearerToken(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : '';
}

function generateTemporaryPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

app.post('/api/system/setup', async (req, res) => {
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ code: 'LOOPBACK_REQUIRED', error: 'Thiết lập ban đầu chỉ được thực hiện trên máy chủ.' });
  }
  if (!db.isFirstRun()) {
    return res.status(400).json({ error: 'Hệ thống đã được khởi tạo tài khoản quản trị trước đó.' });
  }
  const { username, password, fullName, serverName, className } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu không được để trống.' });
  }
  try {
    const passwordHash = await hashPassword(password);
    const result = db.setupFirstAdmin({ username, passwordHash, fullName, serverName, className });
    const session = await auth.login(username, password);
    res.json({ success: true, ...session, user: safeUser(result.admin), defaultClass: result.defaultClass });
  } catch (error) {
    handleAuthFailure(res, error);
  }
});

app.post('/api/auth/register', loginRateLimiter, async (req, res) => {
  try {
    const result = await auth.registerStudent(req.body || {});
    loginAttempts.delete(req.ip || req.socket.remoteAddress);
    res.status(201).json(result);
  } catch (error) {
    handleAuthFailure(res, error);
  }
});

app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  try {
    const result = await auth.login(req.body?.username, req.body?.password);
    loginAttempts.delete(ip);
    res.json(result);
  } catch (error) {
    if (error instanceof AuthError && error.code === 'INVALID_CREDENTIALS') {
      const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      record.count += 1;
      if (record.count >= 5) record.lockedUntil = Date.now() + 5 * 60 * 1000;
      loginAttempts.set(ip, record);
    }
    handleAuthFailure(res, error);
  }
});

app.get('/api/auth/me', auth.authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', auth.authenticate, (req, res) => {
  auth.revokeAccessToken(req.accessToken);
  res.json({ success: true });
});

app.put('/api/auth/password', auth.authenticate, async (req, res) => {
  try {
    const user = await auth.changePassword(req.user.id, req.body?.currentPassword, req.body?.newPassword);
    res.json({ success: true, user });
  } catch (error) {
    handleAuthFailure(res, error);
  }
});

app.use('/api', (req, res, next) => {
  const isPublicUpdateRead = req.method === 'GET' && (
    req.path === '/update/check' || req.path === '/update/download'
  );
  if (isPublicUpdateRead) return next();
  return auth.authenticate(req, res, next);
});

// DIAGNOSTICS & SYSTEM STATUS
app.get('/api/diagnostics', requireHost, (req, res) => {
  const diag = judge.getDiagnostics();
  const ips = lan.getLocalIPs();
  res.json({
    ...diag,
    localIps: ips,
    queue: {
      length: queue.queue.length,
      activeWorkers: queue.activeWorkers,
      concurrency: queue.concurrency
    },
    settings: db.getSettings()
  });
});

// SETTINGS
app.get('/api/settings', requireHost, (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', requireHost, (req, res) => {
  const updated = db.updateSettings(req.body);
  io.emit('settings:update', updated);
  res.json(updated);
});

function emitProblemUpdate(problem) {
  io.to('role:host').emit('problems:update', sanitizeProblemForHost(problem));
  io.to('role:user').emit('problems:update', sanitizeProblemForStudent(problem));
}

function emitContestEvent(eventName, contest) {
  io.to('role:host').emit(eventName, sanitizeContestForHost(contest));
  io.to('role:user').emit(eventName, sanitizeContestForStudent(contest));
}

// PROBLEMS
app.get('/api/problems', (req, res) => {
  const problems = db.getProblems();
  const serializer = req.user.role === 'host' ? sanitizeProblemForHost : sanitizeProblemForStudent;
  res.json(problems.map(serializer));
});

app.get('/api/problems/:id', (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Bài tập không tồn tại' });

  if (req.user.role !== 'host') {
    return res.json(sanitizeProblemForStudent(prob));
  }

  res.json(sanitizeProblemForHost(prob));
});

app.post('/api/problems', requireHost, (req, res) => {
  try {
    const prob = db.createProblem(req.body);
    emitProblemUpdate(prob);
    res.json(prob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/problems/:id', requireHost, (req, res) => {
  const updated = db.updateProblem(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  emitProblemUpdate(updated);
  res.json(updated);
});

app.delete('/api/problems/:id', requireHost, (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (prob && prob._pdfDiskPath && fs.existsSync(prob._pdfDiskPath)) {
    try { fs.unlinkSync(prob._pdfDiskPath); } catch (e) {}
  }
  db.deleteProblem(req.params.id);
  io.emit('problems:delete', req.params.id);
  res.json({ success: true });
});

// HELPER: MIME TYPE FOR ATTACHMENT STATEMENTS
function getStatementMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.bmp': return 'image/bmp';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.md': return 'text/markdown; charset=utf-8';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc': return 'application/msword';
    default: return 'application/octet-stream';
  }
}

// HELPER: Convert DOCX/DOC or TXT/MD to HTML/Text for Online Docs Reader
async function parseDocumentToHtml(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx' || ext === '.doc') {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.convertToHtml({ buffer });
      return result.value || '';
    } catch (e) {
      console.warn('Mammoth docx parse error:', e.message);
      return '';
    }
  } else if (ext === '.txt' || ext === '.md') {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      return '';
    }
  }
  return '';
}

// PARSE DOCUMENT ON THE FLY (FOR INSTANT DOCUMENT PREVIEW BEFORE SAVING)
app.post('/api/parse-document', requireHost, async (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileData) return res.status(400).json({ error: 'Không có dữ liệu file' });
    const ext = path.extname(fileName || '').toLowerCase();
    
    // Extract base64 buffer
    let buffer;
    if (fileData.includes(';base64,')) {
      const b64 = fileData.split(';base64,')[1];
      buffer = Buffer.from(b64, 'base64');
    } else {
      buffer = Buffer.from(fileData, 'base64');
    }

    if (ext === '.docx' || ext === '.doc') {
      try {
        const result = await mammoth.convertToHtml({ buffer });
        return res.json({ type: 'html', content: result.value || '', fileName });
      } catch (err) {
        return res.json({ type: 'error', error: 'Không thể giải mã file DOCX: ' + err.message, fileName });
      }
    } else if (ext === '.txt' || ext === '.md') {
      const text = buffer.toString('utf8');
      return res.json({ type: 'text', content: text, fileName });
    } else if (ext === '.pdf') {
      return res.json({ type: 'pdf', content: fileData, fileName });
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) {
      return res.json({ type: 'image', content: fileData, fileName });
    }
    return res.json({ type: 'other', fileName });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi parse document: ' + err.message });
  }
});

// GET STATEMENT CONTENT FOR PROBLEM (Inline Docs/HTML reader)
app.get('/api/problems/:id/statement-content', async (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

  let filePath = prob._pdfDiskPath;
  if (!filePath || !fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      const match = files.find(f => f.startsWith(`prob_${prob.id}_`));
      if (match) filePath = path.join(uploadsDir, match);
    } catch (e) {}
  }

  if (!filePath || !fs.existsSync(filePath)) {
    const testFolder = path.join(process.cwd(), 'TEST', prob.code);
    if (fs.existsSync(testFolder)) {
      try {
        const files = fs.readdirSync(testFolder);
        const match = files.find(f => {
          const l = f.toLowerCase();
          return l.endsWith('.pdf') || l.endsWith('.docx') || l.endsWith('.doc') || 
                 l.endsWith('.png') || l.endsWith('.jpg') || l.endsWith('.jpeg') || 
                 l.endsWith('.webp') || l.endsWith('.txt') || l.endsWith('.md');
        });
        if (match) filePath = path.join(testFolder, match);
      } catch (e) {}
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.json({ 
      type: prob.statementHtml ? 'html' : (prob.description ? 'text' : 'none'), 
      content: prob.statementHtml || prob.description || '', 
      fileName: prob.pdfFileName || '' 
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileName = prob.pdfFileName || path.basename(filePath);

  if (ext === '.docx' || ext === '.doc') {
    const html = await parseDocumentToHtml(filePath);
    return res.json({ type: 'html', content: html, fileName, url: prob.pdfUrl || `/api/problems/${prob.id}/pdf` });
  } else if (ext === '.txt' || ext === '.md') {
    const text = fs.readFileSync(filePath, 'utf8');
    return res.json({ type: 'text', content: text, fileName, url: prob.pdfUrl || `/api/problems/${prob.id}/pdf` });
  } else if (ext === '.pdf') {
    return res.json({ type: 'pdf', content: '', fileName, url: prob.pdfUrl || `/api/problems/${prob.id}/pdf` });
  } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return res.json({ type: 'image', content: '', fileName, url: prob.pdfUrl || `/api/problems/${prob.id}/pdf` });
  }

  res.json({ type: 'other', content: '', fileName, url: prob.pdfUrl || `/api/problems/${prob.id}/pdf` });
});

// STATEMENT UPLOAD FOR PROBLEM (PDF, Word, Ảnh, Text...)
app.post('/api/problems/:id/pdf', requireHost, async (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

  const { fileName, fileData } = req.body;
  if (!fileData) return res.status(400).json({ error: 'Thiếu dữ liệu file đề bài' });

  try {
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeName = (fileName || 'debai.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `prob_${prob.id}_${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, diskFileName);

    if (prob._pdfDiskPath && fs.existsSync(prob._pdfDiskPath)) {
      try { fs.unlinkSync(prob._pdfDiskPath); } catch (e) {}
    }

    fs.writeFileSync(filePath, buffer);

    let statementHtml = '';
    if (safeName.toLowerCase().endsWith('.docx') || safeName.toLowerCase().endsWith('.doc')) {
      try {
        const r = await mammoth.convertToHtml({ buffer });
        statementHtml = r.value || '';
      } catch (e) {}
    }

    const updated = db.updateProblem(prob.id, {
      pdfUrl: `/api/problems/${prob.id}/pdf`,
      pdfFileName: fileName || safeName,
      statementHtml,
      _pdfDiskPath: filePath
    });

    emitProblemUpdate(updated);
    res.json({ success: true, problem: updated });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lưu file đề bài: ' + err.message });
  }
});

// GET STATEMENT FILE FOR PROBLEM (Inline view or download for PDF, Images, Word, Text)
app.get('/api/problems/:id/pdf', (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

  let filePath = prob._pdfDiskPath;
  if (!filePath || !fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      const match = files.find(f => f.startsWith(`prob_${prob.id}_`));
      if (match) filePath = path.join(uploadsDir, match);
    } catch (e) {}
  }

  // Also check if problem folder has a statement in TEST/{code}/*.(pdf|docx|png|jpg|txt|md)
  if (!filePath || !fs.existsSync(filePath)) {
    const testFolder = path.join(process.cwd(), 'TEST', prob.code);
    if (fs.existsSync(testFolder)) {
      try {
        const files = fs.readdirSync(testFolder);
        const match = files.find(f => {
          const l = f.toLowerCase();
          return l.endsWith('.pdf') || l.endsWith('.docx') || l.endsWith('.doc') || 
                 l.endsWith('.png') || l.endsWith('.jpg') || l.endsWith('.jpeg') || 
                 l.endsWith('.webp') || l.endsWith('.txt') || l.endsWith('.md');
        });
        if (match) filePath = path.join(testFolder, match);
      } catch (e) {}
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Không tìm thấy file đề bài' });
  }

  const mimeType = getStatementMimeType(filePath);
  const isInline = mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(prob.pdfFileName || prob.code + path.extname(filePath))}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// DELETE STATEMENT FOR PROBLEM
app.delete('/api/problems/:id/pdf', requireHost, (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

  if (prob._pdfDiskPath && fs.existsSync(prob._pdfDiskPath)) {
    try { fs.unlinkSync(prob._pdfDiskPath); } catch (e) {}
  }

  const updated = db.updateProblem(prob.id, {
    pdfUrl: '',
    pdfFileName: '',
    statementHtml: '',
    _pdfDiskPath: ''
  });

  emitProblemUpdate(updated);
  res.json({ success: true, problem: updated });
});

// STATEMENT UPLOAD FOR CONTEST (Đề thi tổng hợp kỳ thi - PDF, Word, Ảnh, Text)
app.post('/api/contests/:id/pdf', requireHost, async (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });

  const { fileName, fileData } = req.body;
  if (!fileData) return res.status(400).json({ error: 'Thiếu dữ liệu file đề thi' });

  try {
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeName = (fileName || 'dethi.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `contest_${contest.id}_${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, diskFileName);

    if (contest._pdfDiskPath && fs.existsSync(contest._pdfDiskPath)) {
      try { fs.unlinkSync(contest._pdfDiskPath); } catch (e) {}
    }

    fs.writeFileSync(filePath, buffer);

    let statementHtml = '';
    if (safeName.toLowerCase().endsWith('.docx') || safeName.toLowerCase().endsWith('.doc')) {
      try {
        const r = await mammoth.convertToHtml({ buffer });
        statementHtml = r.value || '';
      } catch (e) {}
    }

    const updated = db.updateContest(contest.id, {
      pdfUrl: `/api/contests/${contest.id}/pdf`,
      pdfFileName: fileName || safeName,
      statementHtml,
      _pdfDiskPath: filePath
    });

    emitContestEvent('contest:updated', updated);
    res.json({ success: true, contest: updated });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lưu file đề thi: ' + err.message });
  }
});

// GET STATEMENT CONTENT FOR CONTEST (Inline Docs/HTML reader)
app.get('/api/contests/:id/statement-content', async (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });

  let filePath = contest._pdfDiskPath;
  if (!filePath || !fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      const match = files.find(f => f.startsWith(`contest_${contest.id}_`));
      if (match) filePath = path.join(uploadsDir, match);
    } catch (e) {}
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.json({ 
      type: contest.statementHtml ? 'html' : (contest.description ? 'text' : 'none'), 
      content: contest.statementHtml || contest.description || '', 
      fileName: contest.pdfFileName || '' 
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileName = contest.pdfFileName || path.basename(filePath);

  if (ext === '.docx' || ext === '.doc') {
    const html = await parseDocumentToHtml(filePath);
    return res.json({ type: 'html', content: html, fileName, url: contest.pdfUrl || `/api/contests/${contest.id}/pdf` });
  } else if (ext === '.txt' || ext === '.md') {
    const text = fs.readFileSync(filePath, 'utf8');
    return res.json({ type: 'text', content: text, fileName, url: contest.pdfUrl || `/api/contests/${contest.id}/pdf` });
  } else if (ext === '.pdf') {
    return res.json({ type: 'pdf', content: '', fileName, url: contest.pdfUrl || `/api/contests/${contest.id}/pdf` });
  } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return res.json({ type: 'image', content: '', fileName, url: contest.pdfUrl || `/api/contests/${contest.id}/pdf` });
  }

  res.json({ type: 'other', content: '', fileName, url: contest.pdfUrl || `/api/contests/${contest.id}/pdf` });
});

// GET STATEMENT FILE FOR CONTEST (Xem trực tiếp hoặc tải về)
app.get('/api/contests/:id/pdf', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });

  let filePath = contest._pdfDiskPath;
  if (!filePath || !fs.existsSync(filePath)) {
    try {
      const files = fs.readdirSync(uploadsDir);
      const match = files.find(f => f.startsWith(`contest_${contest.id}_`));
      if (match) filePath = path.join(uploadsDir, match);
    } catch (e) {}
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Không tìm thấy file đề thi' });
  }

  const mimeType = getStatementMimeType(filePath);
  const isInline = mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(contest.pdfFileName || contest.title + path.extname(filePath))}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// DELETE STATEMENT FOR CONTEST
app.delete('/api/contests/:id/pdf', requireHost, (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });

  if (contest._pdfDiskPath && fs.existsSync(contest._pdfDiskPath)) {
    try { fs.unlinkSync(contest._pdfDiskPath); } catch (e) {}
  }

  const updated = db.updateContest(contest.id, {
    pdfUrl: '',
    pdfFileName: '',
    statementHtml: '',
    _pdfDiskPath: ''
  });

  emitContestEvent('contest:updated', updated);
  res.json({ success: true, contest: updated });
});

// LIST AVAILABLE SAMPLE TESTS FROM 'TEST/' DIRECTORY
app.get('/api/sample-tests', requireHost, (req, res) => {
  const testRoot = path.join(process.cwd(), 'TEST');
  if (!fs.existsSync(testRoot)) {
    return res.json([]);
  }

  try {
    const entries = fs.readdirSync(testRoot, { withFileTypes: true });
    const problems = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const probFolder = path.join(testRoot, ent.name);
      const subEntries = fs.readdirSync(probFolder, { withFileTypes: true });

      const testDirs = subEntries
        .filter(e => e.isDirectory() && /^test\d+/i.test(e.name))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const pdfFile = subEntries.find(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.pdf'));

      let sampleInput = '';
      let sampleOutput = '';
      if (testDirs.length > 0) {
        const firstTestDir = path.join(probFolder, testDirs[0]);
        const testFiles = fs.readdirSync(firstTestDir);
        const inpFile = testFiles.find(f => f.toLowerCase().endsWith('.inp'));
        const outFile = testFiles.find(f => f.toLowerCase().endsWith('.out'));
        if (inpFile) {
          try { sampleInput = fs.readFileSync(path.join(firstTestDir, inpFile), 'utf8'); } catch (e) {}
        }
        if (outFile) {
          try { sampleOutput = fs.readFileSync(path.join(firstTestDir, outFile), 'utf8'); } catch (e) {}
        }
      }

      problems.push({
        code: ent.name.toUpperCase(),
        folder: ent.name,
        testCount: testDirs.length,
        hasPdf: !!pdfFile,
        pdfFileName: pdfFile ? pdfFile.name : null,
        sampleInput: sampleInput.slice(0, 200),
        sampleOutput: sampleOutput.slice(0, 200)
      });
    }

    res.json(problems);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đọc thư mục TEST: ' + err.message });
  }
});

// IMPORT SAMPLE PROBLEMS FROM 'TEST/' FOLDER
app.post('/api/sample-tests/import', requireHost, (req, res) => {
  const { folder, folders, importAll } = req.body || {};
  const testRoot = path.join(process.cwd(), 'TEST');
  if (!fs.existsSync(testRoot)) {
    return res.status(404).json({ error: 'Không tìm thấy thư mục TEST trên máy chủ' });
  }

  try {
    const allEntries = fs.readdirSync(testRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    let targetFolders = [];
    if (importAll) {
      targetFolders = allEntries;
    } else if (folders && Array.isArray(folders)) {
      targetFolders = folders;
    } else if (folder) {
      targetFolders = [folder];
    } else {
      targetFolders = allEntries;
    }

    const importedProblems = [];
    const existingProblems = db.getProblems();

    for (const fName of targetFolders) {
      const probFolder = path.join(testRoot, fName);
      if (!fs.existsSync(probFolder)) continue;

      const subEntries = fs.readdirSync(probFolder, { withFileTypes: true });
      const testDirs = subEntries
        .filter(e => e.isDirectory() && /^test\d+/i.test(e.name))
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const pdfFile = subEntries.find(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.pdf'));

      const testCases = [];
      const cleanCode = fName.toLowerCase();

      testDirs.forEach((td, idx) => {
        const tdPath = path.join(probFolder, td);
        const tf = fs.readdirSync(tdPath);
        const inp = tf.find(f => f.toLowerCase() === `${cleanCode}.inp` || f.toLowerCase().endsWith('.inp'));
        const out = tf.find(f => f.toLowerCase() === `${cleanCode}.out` || f.toLowerCase().endsWith('.out'));

        const inputContent = inp ? fs.readFileSync(path.join(tdPath, inp), 'utf8') : '';
        const outputContent = out ? fs.readFileSync(path.join(tdPath, out), 'utf8') : '';

        testCases.push({
          id: `tc-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          input: inputContent,
          expectedOutput: outputContent,
          isSample: idx === 0,
          isTrap: false,
          score: Math.max(1, Math.round(100 / Math.max(1, testDirs.length)))
        });
      });

      const upperCode = fName.toUpperCase();
      let existing = existingProblems.find(p => p.code === upperCode);
      let probObj;

      const sampleCode = `#include <iostream>\n#include <cstdio>\nusing namespace std;\n\nint main() {\n    // Hỗ trợ cả freopen("${cleanCode}.inp", "r", stdin) hoặc cin/cout:\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    // Viết lời giải bài ${upperCode} tại đây\n    \n    return 0;\n}\n`;

      const titleMap = {
        'LUCKY': 'Con Số May Mắn (LUCKY)',
        'PLAN': 'Kế Hoạch Xây Dựng (PLAN)',
        'TEAM': 'Thành Lập Đội Tuyển (TEAM)'
      };

      if (existing) {
        probObj = db.updateProblem(existing.id, {
          testCases,
          ...(pdfFile ? { pdfUrl: `/api/problems/${existing.id}/pdf`, pdfFileName: pdfFile.name } : {})
        });
      } else {
        probObj = db.createProblem({
          code: upperCode,
          title: titleMap[upperCode] || `Bài Tập ${upperCode}`,
          difficulty: upperCode === 'LUCKY' ? 'Dễ' : upperCode === 'PLAN' ? 'Trung bình' : 'Khó',
          points: 100,
          timeLimit: 1000,
          memoryLimit: 256,
          category: 'C++11',
          description: `### Đề bài ${upperCode}\n\nXem chi tiết yêu cầu trong file đề bài PDF hoặc trao đổi với giáo viên.\n\n- File dữ liệu vào: \`${cleanCode}.inp\` (hoặc nhập từ bàn phím)\n- File dữ liệu ra: \`${cleanCode}.out\` (hoặc in ra màn hình)\n- Giới hạn thời gian: 1000 ms\n- Giới hạn bộ nhớ: 256 MB\n`,
          sampleCode,
          testCases,
          pdfUrl: pdfFile ? `/api/problems/pending/pdf` : '',
          pdfFileName: pdfFile ? pdfFile.name : ''
        });

        if (pdfFile) {
          probObj = db.updateProblem(probObj.id, {
            pdfUrl: `/api/problems/${probObj.id}/pdf`
          });
        }
      }

      emitProblemUpdate(probObj);
      importedProblems.push(probObj);
    }

    res.json({
      success: true,
      message: `Đã import thành công ${importedProblems.length} bài tập từ thư mục TEST!`,
      problems: importedProblems
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi import từ thư mục TEST: ' + err.message });
  }
});

// IMPORT TESTCASES FROM DIRECTORY FORMAT: {ten}/test0x/{ten}.inp,.out
app.post('/api/problems/:id/import-folder', requireHost, (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });

  const { problemCode, tests, append = false } = req.body;
  if (!tests || !Array.isArray(tests) || tests.length === 0) {
    return res.status(400).json({ error: 'Không tìm thấy test case nào trong thư mục' });
  }

  const cleanCode = (problemCode || prob.code).trim().toLowerCase();
  const errors = [];
  const validTestCases = [];

  tests.sort((a, b) => (a.testName || '').localeCompare(b.testName || '', undefined, { numeric: true }));

  const currentTestCases = prob.testCases || [];
  const startIdx = append ? currentTestCases.length : 0;
  const totalCount = append ? currentTestCases.length + tests.length : tests.length;
  const eachScore = Math.max(1, Math.round(100 / totalCount));

  tests.forEach((t, idx) => {
    const expectedInp = `${cleanCode}.inp`;
    const expectedOut = `${cleanCode}.out`;
    const actualInp = (t.inpFile || '').trim().toLowerCase();
    const actualOut = (t.outFile || '').trim().toLowerCase();

    if (actualInp !== expectedInp) {
      errors.push(`Thư mục [${t.testName}]: Tên file input "${t.inpFile}" không khớp "${cleanCode}.inp"`);
    }
    if (actualOut !== expectedOut) {
      errors.push(`Thư mục [${t.testName}]: Tên file output "${t.outFile}" không khớp "${cleanCode}.out"`);
    }

    if (t.input === undefined || t.expectedOutput === undefined) {
      errors.push(`Thư mục [${t.testName}]: Thiếu file input hoặc output`);
    }

    validTestCases.push({
      id: `tc-${Date.now()}-${startIdx + idx + 1}`,
      name: t.testName || `test${String(startIdx + idx + 1).padStart(2, '0')}`,
      input: t.input || '',
      expectedOutput: t.expectedOutput || '',
      isSample: !append && idx === 0,
      isTrap: false,
      score: eachScore
    });
  });

  if (errors.length > 0) {
    return res.status(400).json({ 
      error: `Thư mục test case không hợp lệ (${errors.length} lỗi)`, 
      details: errors 
    });
  }

  const finalTestCases = append ? [...currentTestCases, ...validTestCases] : validTestCases;
  const updated = db.updateProblem(prob.id, { testCases: finalTestCases });
  emitProblemUpdate(updated);
  res.json({ success: true, count: finalTestCases.length, problem: updated });
});

// GET TESTCASES ON DEMAND FOR TEACHER (Lazy-loaded, ultra-fast)
app.get('/api/problems/:id/testcases', requireHost, (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const testCases = db.getProblemTestCases(prob.id);
  res.json(testCases);
});

// DIRECT TESTCASES UPDATE (Add, edit, delete, reorder, score weight, sample toggle)
app.put('/api/problems/:id/testcases', requireHost, (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const { testCases } = req.body;
  if (!Array.isArray(testCases)) return res.status(400).json({ error: 'Dữ liệu test cases không hợp lệ' });
  const updated = db.updateProblem(prob.id, { testCases });
  emitProblemUpdate(updated);
  res.json({ success: true, count: testCases.length, testCases: updated.testCases });
});

// SUBMISSIONS
app.get('/api/submissions', (req, res) => {
  const filter = {
    userId: req.user.role === 'host' ? req.query.userId : req.user.id,
    problemId: req.query.problemId,
    contestId: req.query.contestId,
    virtualSessionId: req.query.virtualSessionId,
    isVirtual: req.query.isVirtual
  };
  const submissions = db.getSubmissions(filter);
  res.json(req.user.role === 'host' ? submissions : submissions.map(sanitizeSubmissionForStudent));
});

app.get('/api/submissions/:id', (req, res) => {
  const sub = db.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  if (req.user.role !== 'host' && sub.userId !== req.user.id) {
    return res.status(403).json({ code: 'SUBMISSION_FORBIDDEN', error: 'Bạn không có quyền xem bài nộp này.' });
  }
  res.json(req.user.role === 'host' ? sub : sanitizeSubmissionForStudent(sub));
});

// GET FULL RAW TESTCASE DETAILS FOR SUBMISSION (On-demand inspection for teachers)
app.get('/api/submissions/:id/full-test/:testIndex', requireHost, (req, res) => {
  const sub = db.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy bài nộp' });

  const testIdx = parseInt(req.params.testIndex, 10);
  const detail = (sub.details || []).find(d => d.testIndex === testIdx) || sub.details?.[testIdx - 1];

  // Fetch complete raw testcase directly from testcase store on disk
  const testCases = db.getProblemTestCases(sub.problemId);
  const tc = (testCases && testCases.length >= testIdx) ? testCases[testIdx - 1] : null;

  res.json({
    testIndex: testIdx,
    name: detail?.name || tc?.name || `Test #${testIdx}`,
    status: detail?.status || 'UNKNOWN',
    time: detail?.time || 0,
    memory: detail?.memory || 0,
    scoreEarned: detail?.scoreEarned || 0,
    message: detail?.message || '',
    fullInput: tc?.input !== undefined ? tc.input : (detail?.input || ''),
    fullExpectedOutput: tc?.expectedOutput !== undefined ? tc.expectedOutput : (detail?.expectedOutput || ''),
    userOutput: detail?.userOutput || '',
    diff: detail?.diff || ''
  });
});

// Helper: Check if client IP is within whitelist (supports exact, wildcard 192.168.1.*, or range 192.168.1.10-50)
function isIpAllowed(clientIp, whitelistStr) {
  if (!whitelistStr || !whitelistStr.trim()) return true;
  const cleanClient = String(clientIp || '').replace(/^::ffff:/, '').trim();

  const rules = whitelistStr.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean);
  if (rules.length === 0) return true;

  for (const rule of rules) {
    if (rule === cleanClient || (cleanClient === '127.0.0.1' && (rule === 'localhost' || rule === '127.0.0.1'))) {
      return true;
    }
    if (rule.includes('*')) {
      const regexPattern = '^' + rule.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      if (new RegExp(regexPattern).test(cleanClient)) {
        return true;
      }
    }
    if (rule.includes('-')) {
      const [startStr, endStr] = rule.split('-').map(s => s.trim());
      const ipToNum = (ip) => {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
        return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + parts[3];
      };

      const clientNum = ipToNum(cleanClient);
      const startNum = ipToNum(startStr);
      let endNum = ipToNum(endStr);

      if (!endNum && /^\d+$/.test(endStr) && startStr.includes('.')) {
        const parts = startStr.split('.');
        parts[3] = endStr;
        endNum = ipToNum(parts.join('.'));
      }

      if (clientNum !== null && startNum !== null && endNum !== null) {
        if (clientNum >= Math.min(startNum, endNum) && clientNum <= Math.max(startNum, endNum)) {
          return true;
        }
      }
    }
  }
  return false;
}

app.post('/api/submissions', submissionRateLimiter, (req, res) => {
  const { problemId, code, contestId, virtualSessionId } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Mã nguồn không được để trống' });
  }
  if (req.user.role !== 'user') {
    return res.status(403).json({ code: 'STUDENT_REQUIRED', error: 'Chỉ tài khoản học sinh được nộp bài.' });
  }

  const settings = db.getSettings();
  if (settings && settings.submissionsClosed) {
    return res.status(403).json({ error: 'Cổng nộp bài hiện đã đóng. Giáo viên không nhận thêm bài nộp.' });
  }

  let contest = null;
  let virtualSession = null;
  const isVirtualSubmission = !!virtualSessionId;
  if (isVirtualSubmission) {
    virtualSession = db.getVirtualSession(virtualSessionId);
    if (!virtualSession) {
      return res.status(404).json({ code: 'VIRTUAL_SESSION_NOT_FOUND', error: 'Phiên thi ảo không tồn tại.' });
    }
    if (virtualSession.userId !== req.user.id) {
      return res.status(403).json({ code: 'VIRTUAL_SESSION_FORBIDDEN', error: 'Phiên thi ảo không thuộc tài khoản này.' });
    }
    const now = Date.now();
    const end = new Date(virtualSession.endTime).getTime();
    if (virtualSession.status === 'completed' || now > end) {
      return res.status(403).json({ code: 'VIRTUAL_SESSION_ENDED', error: 'Phiên thi ảo đã hết giờ làm bài.' });
    }
    if (contestId && contestId !== virtualSession.contestId) {
      return res.status(403).json({ code: 'VIRTUAL_CONTEST_MISMATCH', error: 'Phiên thi ảo không thuộc kỳ thi đã gửi.' });
    }
    contest = db.getContest(virtualSession.contestId);
    if (!contest) return res.status(404).json({ code: 'CONTEST_NOT_FOUND', error: 'Kỳ thi không tồn tại.' });
  } else if (contestId) {
    contest = db.getContest(contestId);
    if (!contest) return res.status(404).json({ code: 'CONTEST_NOT_FOUND', error: 'Kỳ thi không tồn tại.' });
  }

  const rawCode = String(req.body.problemCode || problemId || req.body.filename || '').trim();
  const cleanCode = rawCode.replace(/\.(cpp|pas|py|c|java|txt)$/i, '').trim().toLowerCase();

  let prob = db.getProblem(problemId);
  if (!prob && cleanCode) {
    prob = db.getProblem(cleanCode);
  }
  if (!prob && contest) {
    const contestProbs = (contest.problemIds || []).map(pId => db.getProblem(pId)).filter(Boolean);
    prob = contestProbs.find(p => 
      p.id === problemId || 
      p.code.toLowerCase() === cleanCode ||
      p.code.toLowerCase() === rawCode.toLowerCase()
    );
  }
  if (!prob && cleanCode && !contest) {
    // Search all problems in db by code case-insensitively
    prob = db.getProblems().find(p => p.code?.toLowerCase() === cleanCode);
  }
  if (!prob) {
    return res.status(404).json({ error: 'Không tìm thấy bài tập tương ứng để chấm (Tên bài không khớp với đề thi)' });
  }

  if (contest && !isVirtualSubmission) {
    try {
      assertSubmissionAllowed({
        contest,
        user: req.user,
        attendance: db.getContestAttendanceRecord(contest.id, req.user.id),
        now: Date.now(),
        joined: auth.hasJoinedContest(getBearerToken(req), contest.id),
        problemId: prob.id
      });
    } catch (error) {
      return handlePolicyFailure(res, error);
    }

    if (contest.ipWhitelist && contest.ipWhitelist.trim()) {
      const clientIp = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      if (!isIpAllowed(clientIp, contest.ipWhitelist)) {
        return res.status(403).json({ code: 'IP_NOT_ALLOWED', error: `Địa chỉ IP (${clientIp}) không nằm trong dải phòng thi được phép.` });
      }
    }
  }

  if (contest && isVirtualSubmission && !(contest.problemIds || []).includes(prob.id)) {
    return res.status(403).json({ code: 'PROBLEM_NOT_IN_CONTEST', error: 'Bài tập không thuộc kỳ thi này.' });
  }

  const sub = db.createSubmission({
    userId: req.user.id,
    userName: req.user.fullName || req.user.username,
    problemId: prob.id,
    problemCode: prob.code,
    code,
    totalTests: (prob.testCases || []).length,
    contestId: contest ? contest.id : null,
    isVirtual: isVirtualSubmission,
    virtualSessionId: virtualSessionId || null,
    requireFreopen: !!contest?.requireFreopen
  });

  // Check submission mode: direct vs batch (chế độ nộp bài)
  // In virtual mode, always grade directly so student gets immediate feedback!
  const isBatchMode = !isVirtualSubmission && ((contest && contest.gradingMode === 'batch_after_deadline') || (settings && settings.submissionMode === 'batch'));
  if (!isBatchMode) {
    queue.enqueue(sub.id);
  }

  io.to('role:host').emit('submission:created', sub);
  io.to(`user:${sub.userId}`).emit('submission:created', sanitizeSubmissionForStudent(sub));
  res.json({
    ...sanitizeSubmissionForStudent(sub),
    mode: isBatchMode ? 'batch' : 'direct',
    note: isBatchMode ? 'Bài nộp đã được ghi nhận trong kỳ thi. Kết quả sẽ được công bố sau khi kết thúc giờ làm bài.' : undefined
  });
});

// Toggle submission portal open/close
app.post('/api/submissions/toggle-close', requireHost, (req, res) => {
  const current = db.getSettings();
  const updated = db.updateSettings({ submissionsClosed: !current.submissionsClosed });
  io.emit('settings:update', updated);
  res.json({ submissionsClosed: updated.submissionsClosed });
});

// CUSTOM INPUT RUN (Instant test run without scoring)
app.post('/api/custom-run', async (req, res) => {
  const { code, input, problemCode, timeLimit = 1500, memoryLimit = 256 } = req.body;
  if (!code) return res.status(400).json({ error: 'Vui lòng nhập code' });

  try {
    const result = await judge.runCustomInput(code, input || '', Number(timeLimit) || 1500, Number(memoryLimit) || 256, problemCode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LEADERBOARD
app.get('/api/leaderboard', (req, res) => {
  res.json(db.getLeaderboard());
});

// BATCH GRADE ALL (Teacher: grade all submissions that haven't been judged or re-grade)
// In-memory cancel token per job
let batchGradeJob = null; // { cancel: boolean }

app.post('/api/grade-all', requireHost, async (req, res) => {
  // Accept optional problemId filter
  const { problemId, regrade = false } = req.body || {};

  let allSubs = db.getSubmissions(problemId ? { problemId } : {});
  if (!regrade) {
    // Only grade QUEUED or not-yet-judged
    allSubs = allSubs.filter(s => !s.status || s.status === 'QUEUED');
  }

  if (allSubs.length === 0) {
    return res.json({ message: 'Không có bài nào cần chấm.', total: 0 });
  }

  // Cancel any previous job
  if (batchGradeJob) batchGradeJob.cancel = true;
  batchGradeJob = { cancel: false };
  const job = batchGradeJob;

  const total = allSubs.length;
  let done = 0, success = 0, errors = 0;
  const errorList = [];

  // Respond immediately so client can listen to socket events
  res.json({ message: 'Batch grading started', total });

  // Emit initial progress
  io.emit('batch:grade:progress', { total, done, success, errors, finished: false, cancelled: false });

  // Process sequentially (to avoid overloading the judge)
  for (const sub of allSubs) {
    if (job.cancel) {
      io.emit('batch:grade:progress', { total, done, success, errors, finished: false, cancelled: true, errorList });
      batchGradeJob = null;
      return;
    }

    const problem = db.getProblem(sub.problemId);
    if (!problem) {
      errors++;
      done++;
      errorList.push({ submissionId: sub.id, userName: sub.userName || sub.userId, problemCode: sub.problemCode, error: 'Bài tập không tồn tại', status: 'RE' });
      io.emit('batch:grade:progress', { total, done, success, errors, currentUser: sub.userName, currentProblem: sub.problemCode, finished: false, cancelled: false, errorList });
      continue;
    }

    io.emit('batch:grade:progress', {
      total, done, success, errors,
      currentUser: sub.userName || sub.userId,
      currentProblem: problem.code,
      finished: false,
      cancelled: false,
      errorList
    });

    try {
      const result = await judge.gradeSubmission(sub, problem, null);
      db.updateSubmission(sub.id, {
        status: result.status,
        score: result.score,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        compileError: result.compileError,
        details: result.details
      });
      if (result.status === 'CE' || result.status === 'RE') {
        errors++;
        errorList.push({
          submissionId: sub.id,
          userName: sub.userName || sub.userId,
          problemCode: problem.code,
          status: result.status,
          error: result.status === 'CE' 
            ? `Lỗi biên dịch (CE): ${result.compileError ? result.compileError.split('\n')[0].slice(0, 100) : 'Lỗi cú pháp'}` 
            : 'Lỗi thực thi (Runtime Error)'
        });
      } else {
        success++;
      }
    } catch (err) {
      errors++;
      errorList.push({ submissionId: sub.id, userName: sub.userName || sub.userId, problemCode: problem.code, error: err.message, status: 'RE' });
    }
    done++;

    io.emit('batch:grade:progress', {
      total, done, success, errors,
      currentUser: sub.userName || sub.userId,
      currentProblem: problem.code,
      finished: false,
      cancelled: false,
      errorList
    });
  }

  // Final result
  batchGradeJob = null;
  io.emit('batch:grade:progress', { total, done, success, errors, finished: true, cancelled: false, errorList });
  io.emit('leaderboard:update', db.getLeaderboard());
});

app.delete('/api/grade-all/cancel', requireHost, (req, res) => {
  if (batchGradeJob) {
    batchGradeJob.cancel = true;
    res.json({ message: 'Hủy đang được xử lý...' });
  } else {
    res.json({ message: 'Không có tác vụ chấm hàng loạt nào đang chạy.' });
  }
});

// ─── CONTESTS APIS ────────────────────────────────────────────────────────
function withDynamicContestStatus(contest, now = Date.now()) {
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  let status = contest.status;
  if (status !== 'ended') {
    if (now < start) status = 'upcoming';
    else if (now <= end) status = 'running';
    else status = 'ended';
  }
  return { ...contest, status };
}

app.get('/api/contests', (req, res) => {
  let contests = db.getContests().map(contest => withDynamicContestStatus(contest));

  if (req.user.role === 'host') {
    return res.json(contests.map(contest => sanitizeContestForHost(contest)));
  }

  contests = contests.filter(contest => {
    if (Array.isArray(contest.candidateIds) && contest.candidateIds.length > 0) {
      return contest.candidateIds.includes(req.user.id);
    }
    return !Array.isArray(contest.classIds) || contest.classIds.length === 0 || contest.classIds.includes(req.user.classId);
  });
  res.json(contests.map(contest => sanitizeContestForStudent(contest)));
});

app.get('/api/contests/:id', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  
  const dynamicContest = withDynamicContestStatus(contest);
  const rawProblems = (contest.problemIds || []).map(pId => db.getProblem(pId)).filter(Boolean);
  if (req.user.role === 'host') {
    return res.json(sanitizeContestForHost(dynamicContest, rawProblems));
  }
  res.json(sanitizeContestForStudent(dynamicContest));
});

app.post('/api/contests/:id/join', (req, res) => {
  const contest = db.getContest(req.params.id);
  const attendance = db.getContestAttendanceRecord(req.params.id, req.user.id);
  try {
    const policy = assertJoinAllowed({
      contest,
      user: req.user,
      suppliedPin: req.body?.pinCode,
      attendance,
      now: Date.now()
    });
    if (!auth.markContestJoined(getBearerToken(req), contest.id)) {
      return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
    db.updateContestAttendance(contest.id, req.user.id, {
      status: 'present',
      ip: String(req.socket.remoteAddress || '').replace(/^::ffff:/, ''),
      lastActive: new Date().toISOString()
    });
    const problems = (contest.problemIds || []).map(problemId => db.getProblem(problemId)).filter(Boolean);
    res.json({
      ...sanitizeContestForStudent(withDynamicContestStatus(contest), problems),
      effectiveEndTime: new Date(policy.effectiveEndTime).toISOString()
    });
  } catch (error) {
    handlePolicyFailure(res, error);
  }
});

function processContestImportedProblems(importedProblems, existingProblemIds = []) {
  if (!Array.isArray(importedProblems) || importedProblems.length === 0) {
    return existingProblemIds;
  }
  const problemIds = [...existingProblemIds];
  const allProblems = db.getProblems() || [];

  for (const imp of importedProblems) {
    if (!imp || !imp.code) continue;
    const cleanCode = String(imp.code).trim().toUpperCase();
    const cleanTitle = String(imp.title || imp.code || '').trim() || cleanCode;
    const existing = allProblems.find(p => p && p.code && p.code.toUpperCase() === cleanCode);
    const probPoints = Number(imp.points) || 100;
    const testCount = Math.max(1, (imp.testCases || []).length);
    const autoScore = Math.round((probPoints / testCount) * 100) / 100;

    const testCases = (imp.testCases || []).map((tc, idx) => ({
      id: `tc-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      name: tc.name || `test${String(idx + 1).padStart(2, '0')}`,
      input: tc.input || '',
      expectedOutput: tc.expectedOutput || '',
      isSample: tc.isSample !== undefined ? !!tc.isSample : idx === 0,
      score: Number(tc.points) || autoScore
    }));

    // Extract samples for students
    const samples = (imp.samples && Array.isArray(imp.samples) && imp.samples.length > 0)
      ? imp.samples
      : testCases.filter(tc => tc.isSample).map((tc, idx) => ({
          id: `sample-${idx + 1}`,
          name: `Ví dụ ${idx + 1}`,
          input: tc.input || '',
          output: tc.expectedOutput || ''
        }));
    if (samples.length === 0 && testCases.length > 0) {
      samples.push({
        id: 'sample-1',
        name: 'Ví dụ 1',
        input: testCases[0].input || '',
        output: testCases[0].expectedOutput || ''
      });
    }

    if (existing) {
      db.updateProblem(existing.id, {
        title: cleanTitle,
        testCases: testCases.length > 0 ? testCases : existing.testCases,
        samples: samples,
        points: probPoints,
        timeLimit: Number(imp.timeLimit) || existing.timeLimit || 1000,
        memoryLimit: Number(imp.memoryLimit) || existing.memoryLimit || 256
      });
      if (!problemIds.includes(existing.id)) {
        problemIds.push(existing.id);
      }
    } else {
      const created = db.createProblem({
        code: cleanCode,
        title: cleanTitle,
        difficulty: 'Trung bình',
        points: probPoints,
        timeLimit: Number(imp.timeLimit) || 1000,
        memoryLimit: Number(imp.memoryLimit) || 256,
        samples: samples,
        testCases: testCases
      });
      if (created && !problemIds.includes(created.id)) {
        problemIds.push(created.id);
      }
    }
  }
  return problemIds;
}

app.post('/api/contests', requireHost, (req, res) => {
  try {
    const { title, importedProblems, problemConfigs } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Tên kỳ thi không được để trống' });
    }
    let contestData = { ...req.body };
    if (Array.isArray(importedProblems) && importedProblems.length > 0) {
      contestData.problemIds = processContestImportedProblems(importedProblems, contestData.problemIds || []);
    }
    if (problemConfigs && typeof problemConfigs === 'object') {
      for (const [probId, cfg] of Object.entries(problemConfigs)) {
        if (probId && cfg) {
          const fields = {};
          if (cfg.points !== undefined && !isNaN(Number(cfg.points))) fields.points = Number(cfg.points);
          if (cfg.timeLimit !== undefined && !isNaN(Number(cfg.timeLimit))) fields.timeLimit = Number(cfg.timeLimit);
          if (cfg.memoryLimit !== undefined && !isNaN(Number(cfg.memoryLimit))) fields.memoryLimit = Number(cfg.memoryLimit);
          if (cfg.title) fields.title = String(cfg.title).trim();
          db.updateProblem(probId, fields);
        }
      }
    }
    const contest = db.createContest(contestData);
    emitContestEvent('contest:created', contest);
    res.json(contest);
  } catch (err) {
    console.error('[Create Contest Error]', err);
    res.status(500).json({ error: err.message || 'Lỗi khi lưu kỳ thi trên máy chủ' });
  }
});

app.put('/api/contests/:id', requireHost, (req, res) => {
  try {
    const { problemConfigs } = req.body;
    let updateData = { ...req.body };
    if (Array.isArray(req.body.importedProblems) && req.body.importedProblems.length > 0) {
      const existing = db.getContest(req.params.id);
      const existingIds = updateData.problemIds || existing?.problemIds || [];
      updateData.problemIds = processContestImportedProblems(req.body.importedProblems, existingIds);
    }
    if (problemConfigs && typeof problemConfigs === 'object') {
      for (const [probId, cfg] of Object.entries(problemConfigs)) {
        if (probId && cfg) {
          const fields = {};
          if (cfg.points !== undefined && !isNaN(Number(cfg.points))) fields.points = Number(cfg.points);
          if (cfg.timeLimit !== undefined && !isNaN(Number(cfg.timeLimit))) fields.timeLimit = Number(cfg.timeLimit);
          if (cfg.memoryLimit !== undefined && !isNaN(Number(cfg.memoryLimit))) fields.memoryLimit = Number(cfg.memoryLimit);
          if (cfg.title) fields.title = String(cfg.title).trim();
          db.updateProblem(probId, fields);
        }
      }
    }
    const updated = db.updateContest(req.params.id, updateData);
    if (!updated) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
    emitContestEvent('contest:updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('[Update Contest Error]', err);
    res.status(500).json({ error: err.message || 'Lỗi khi cập nhật kỳ thi trên máy chủ' });
  }
});

app.delete('/api/contests/:id', requireHost, (req, res) => {
  const ok = db.deleteContest(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  io.to('role:user').to('role:host').emit('contest:deleted', { id: req.params.id });
  res.json({ success: true });
});

app.post('/api/contests/:id/toggle-status', requireHost, (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  const { status } = req.body; // 'running' | 'ended' | 'upcoming'
  const updated = db.updateContest(req.params.id, { status });
  emitContestEvent('contest:updated', updated);
  res.json(updated);
});

app.get('/api/contests/:id/leaderboard', (req, res) => {
  const isVirtual = req.query.virtual === 'true';
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  let submittedBefore;
  const dynamicContest = withDynamicContestStatus(contest);
  const freezeMinutes = Math.max(0, Number(contest.freezeScoreboardMinutes) || 0);
  if (req.user.role !== 'host' && !isVirtual && dynamicContest.status === 'running' && freezeMinutes > 0) {
    const freezeAt = new Date(contest.endTime).getTime() - freezeMinutes * 60 * 1000;
    if (Date.now() >= freezeAt) submittedBefore = freezeAt;
  }
  const leaderboard = db.getContestLeaderboard(req.params.id, isVirtual, { submittedBefore });
  res.json(leaderboard);
});

// ─── VIRTUAL PARTICIPATION (THI ẢO) ─────────────────────────────────────────
app.post('/api/contests/:id/virtual-start', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  if (req.user.role !== 'user') {
    return res.status(403).json({ code: 'STUDENT_REQUIRED', error: 'Chỉ tài khoản học sinh được thi ảo.' });
  }
  if (withDynamicContestStatus(contest).status !== 'ended') {
    return res.status(403).json({ code: 'VIRTUAL_NOT_AVAILABLE', error: 'Thi ảo chỉ mở sau khi kỳ thi chính thức kết thúc.' });
  }

  const session = db.createVirtualSession({
    userId: req.user.id,
    userName: req.user.fullName || req.user.username,
    contestId: contest.id,
    durationMinutes: contest.durationMinutes
  });
  const problems = (contest.problemIds || []).map(problemId => db.getProblem(problemId)).filter(Boolean);
  res.json({ ...session, contest: sanitizeContestForStudent(withDynamicContestStatus(contest), problems) });
});

app.get('/api/contests/:id/virtual-sessions', (req, res) => {
  const userId = req.user.role === 'host' ? req.query.userId : req.user.id;
  const sessions = db.getVirtualSessions({ contestId: req.params.id, userId });
  res.json(sessions);
});

app.post('/api/virtual-sessions/:id/finish', (req, res) => {
  const session = db.getVirtualSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Phiên thi ảo không tồn tại' });
  if (req.user.role !== 'host' && session.userId !== req.user.id) {
    return res.status(403).json({ code: 'VIRTUAL_SESSION_FORBIDDEN', error: 'Phiên thi ảo không thuộc tài khoản này.' });
  }
  const finished = db.finishVirtualSession(req.params.id);
  res.json(finished);
});

app.get('/api/contests/:id/virtual-leaderboard', (req, res) => {
  const board = db.getContestLeaderboard(req.params.id, true);
  res.json(board);
});

// CONTEST ATTENDANCE & ROOM CONTROL
app.get('/api/contests/:id/attendance', requireHost, (req, res) => {
  const attendance = db.getContestAttendance(req.params.id);
  // Merge live socket online status & IP
  const onlineList = Array.from(onlineUsers.values());
  const enriched = attendance.map(item => {
    const live = onlineList.find(o => o.userId === item.userId);
    return {
      ...item,
      isOnline: !!live,
      ip: live?.ip || item.ip || ''
    };
  });
  res.json(enriched);
});

app.post('/api/contests/:id/attendance', requireHost, (req, res) => {
  const { userId, status, reason, extraMinutes } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.updateContestAttendance(req.params.id, userId, { status, reason, extraMinutes });
  io.to('role:host').emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json(updated);
});

app.post('/api/contests/:id/candidates', requireHost, (req, res) => {
  const { candidateIds } = req.body;
  if (!Array.isArray(candidateIds)) return res.status(400).json({ error: 'Danh sách candidateIds không hợp lệ' });
  const contest = db.updateContestCandidates(req.params.id, candidateIds);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });
  io.to('role:host').emit('contest:candidates_updated', { contestId: req.params.id, candidateIds });
  res.json({ success: true, count: candidateIds.length, contest });
});

app.post('/api/contests/:id/extra-time', requireHost, (req, res) => {
  const { userId, extraMinutes = 5 } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.addExtraTime(req.params.id, userId, extraMinutes);
  
  // Realtime notify specific student socket
  for (const [sockId, client] of onlineUsers.entries()) {
    if (client.userId === userId) {
      io.to(sockId).emit('contest:extra_time', {
        contestId: req.params.id,
        extraMinutes: Number(extraMinutes),
        totalExtraMinutes: updated.extraMinutes
      });
    }
  }
  
  io.to('role:host').emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, extraMinutes, totalExtraMinutes: updated.extraMinutes });
});

app.post('/api/contests/:id/reopen', requireHost, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.reopenContestForUser(req.params.id, userId);

  // Realtime notify student
  for (const [sockId, client] of onlineUsers.entries()) {
    if (client.userId === userId) {
      io.to(sockId).emit('contest:reopened', { contestId: req.params.id });
    }
  }

  io.to('role:host').emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, message: 'Đã mở lại lượt thi thành công' });
});

app.post('/api/contests/:id/suspend', requireHost, (req, res) => {
  const { userId, reason = 'Vi phạm quy chế phòng thi' } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.updateContestAttendance(req.params.id, userId, { status: 'suspended', reason });

  // Realtime notify student
  for (const [sockId, client] of onlineUsers.entries()) {
    if (client.userId === userId) {
      io.to(sockId).emit('contest:suspended', { contestId: req.params.id, reason });
    }
  }

  io.to('role:host').emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, message: 'Đã đình chỉ bài thi của học sinh' });
});

// CLASSES & USERS
app.get('/api/classes', requireHost, (req, res) => {
  res.json(db.getClasses());
});

app.post('/api/classes', requireHost, (req, res) => {
  const cls = db.createClass(req.body);
  res.json(cls);
});

app.get('/api/users', requireHost, (req, res) => {
  res.json(db.getUsers().map(safeUser));
});

app.post('/api/users', requireHost, async (req, res) => {
  try {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const user = db.createUser({
      username: req.body?.username,
      fullName: req.body?.fullName,
      role: 'user',
      classId: req.body?.classId,
      passwordHash,
      mustChangePassword: true
    });
    res.status(201).json({ user: safeUser(user), temporaryPassword });
  } catch (error) {
    handleAuthFailure(res, error);
  }
});

// BATCH CREATE STUDENTS
app.post('/api/users/batch', requireHost, async (req, res) => {
  const { students, classId } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'Danh sách học sinh không hợp lệ' });
  }

  const created = [];
  const credentials = [];
  const existingUsers = db.getUsers();

  for (const s of students) {
    const cleanUser = (s.username || '').trim().toLowerCase();
    if (!cleanUser) continue;

    let user = existingUsers.find(u => u.username === cleanUser);
    if (!user) {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      user = db.createUser({
        username: cleanUser,
        passwordHash,
        fullName: s.fullName || cleanUser,
        role: 'user',
        classId: s.classId || classId || (db.getClasses()[0]?.id || 'cls-1'),
        mustChangePassword: true
      });
      created.push(safeUser(user));
      credentials.push({ username: user.username, temporaryPassword });
      existingUsers.push(user);
    }
  }

  res.json({ success: true, count: created.length, created, credentials });
});

// RESET STUDENT PASSWORD
app.put('/api/users/:id/reset-password', requireHost, async (req, res) => {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = db.setUserPasswordHash(req.params.id, passwordHash, true);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  auth.revokeUserSessions(user.id);
  res.json({ success: true, message: 'Đã đặt lại mật khẩu thành công', user: safeUser(user), temporaryPassword });
});

// ONLINE USERS
app.get('/api/users/online', requireHost, (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

// UPDATE USER DETAILS
app.put('/api/users/:id', requireHost, (req, res) => {
  const updated = db.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json(safeUser(updated));
});

// TOGGLE USER LOCK
app.post('/api/users/:id/toggle-lock', requireHost, (req, res) => {
  const updated = db.toggleUserLock(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  
  // If user is locked, disconnect any active sockets
  if (updated.isLocked) {
    auth.revokeUserSessions(updated.id);
    for (const [sockId, client] of onlineUsers.entries()) {
      if (client.userId === req.params.id) {
        const targetSock = io.sockets.sockets.get(sockId);
        if (targetSock) {
          targetSock.emit('auth:locked', { message: 'Tài khoản của bạn đã bị khóa bởi giáo viên' });
          targetSock.disconnect(true);
        }
      }
    }
  }

  res.json(safeUser(updated));
});

// GET USER EXAM HISTORY & PORTFOLIO
app.get('/api/users/:id/history', requireHost, (req, res) => {
  const history = db.getUserExamHistory(req.params.id);
  res.json(history);
});

// DELETE STUDENT ACCOUNT
app.delete('/api/users/:id', requireHost, (req, res) => {
  const user = db.getUser(req.params.id);
  if (user && user.role === 'host') {
    return res.status(403).json({ error: 'Không thể xóa tài khoản Quản trị viên (Admin)' });
  }
  const ok = db.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  auth.revokeUserSessions(req.params.id);
  res.json({ success: true });
});

// ANTI-CHEAT PLAGIARISM CHECKER
app.get('/api/anticheat/scan/:problemId', requireHost, (req, res) => {
  const threshold = Number(req.query.threshold) || 60;
  const results = antiCheat.scanProblemSubmissions(req.params.problemId, threshold);
  res.json(results);
});

// EXPORT REPORT (CSV)
app.get('/api/export/csv', requireHost, (req, res) => {
  const leaderboard = db.getLeaderboard();
  const problems = db.getProblems();

  let csv = 'Hạng,Họ và Tên,Tên Đăng Nhập,Điểm Tổng,Số Bài AC';
  for (const p of problems) {
    csv += `,${p.code} (${p.title})`;
  }
  csv += '\n';

  leaderboard.forEach((user, idx) => {
    let row = `${idx + 1},"${user.userName}","${user.username}",${user.totalScore},${user.problemsSolved}`;
    for (const p of problems) {
      const score = user.solvedProblems[p.id]?.score || 0;
      row += `,${score}`;
    }
    csv += row + '\n';
  });

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('Bao_Cao_Diem_SchoolJudge.csv');
  res.send('\uFEFF' + csv);
});

// OFFICIAL CONTEST REPORT & EXPORT (Strictly REAL participants only)
app.get('/api/contests/:id/official-report', requireHost, (req, res) => {
  const report = db.getOfficialContestReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });
  res.json(report);
});

app.get('/api/contests/:id/export-official-csv', requireHost, (req, res) => {
  const report = db.getOfficialContestReport(req.params.id);
  if (!report) return res.status(404).send('Không tìm thấy kỳ thi');

  // Format: STT, HỌ VÀ TÊN, LỚP, ĐIỂM
  let csv = `BẢNG ĐIỂM KỲ THI: ${report.contestTitle}\n`;
  csv += `Ngày lập: ${new Date().toLocaleDateString('vi-VN')}\n\n`;
  csv += 'STT,HỌ VÀ TÊN,LỚP,ĐIỂM\n';

  report.rows.forEach(r => {
    csv += `${r.stt},"${r.fullName}","${r.className}",${r.score}\n`;
  });

  const safeFileName = `Bang_Diem_${report.contestTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}.csv`;
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(safeFileName);
  res.send('\uFEFF' + csv);
});

// SERVE BUILT FRONTEND FOR DIRECT LAN WEB ACCESS (Port 4000)
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// ========================================
// AUTO-UPDATE API (LAN-based)
// ========================================

function getUpdatesDir() {
  const appDataDir = process.env.APPDATA || process.env.HOME || process.cwd();
  const dir = path.join(appDataDir, 'SchoolJudge LAN', 'updates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function findLatestSignedUpdate() {
  const updatesDir = getUpdatesDir();
  const manifestPath = path.join(updatesDir, 'update-manifest.json');
  try {
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const installerPath = path.join(updatesDir, manifest.fileName || '');
    const publicKey = fs.readFileSync(path.join(__dirname, '..', 'config', 'update-public-key.pem'), 'utf8');
    verifyUpdateArtifact({ manifest, publicKey, installerPath, currentVersion: '0.0.0' });
    return { manifest, installerPath, manifestPath };
  } catch (error) {
    console.error('[Auto-Update] Ignoring invalid signed update:', error.code || error.message);
    return null;
  }
}

// Check for updates - called by Student machines
app.get('/api/update/check', (req, res) => {
  const clientVersion = req.query.version || '0.0.0';
  const latest = findLatestSignedUpdate();

  if (!latest) {
    return res.json({
      updateAvailable: false,
      currentVersion: APP_VERSION,
      clientVersion,
      message: 'Không có bản cập nhật nào trên máy chủ.'
    });
  }

  let isNewer;
  try {
    isNewer = compareVersions(latest.manifest.version, clientVersion) > 0;
  } catch (error) {
    return res.status(400).json({ code: error.code || 'INVALID_UPDATE_VERSION', error: error.message });
  }

  res.json({
    updateAvailable: isNewer,
    currentVersion: APP_VERSION,
    latestVersion: latest.manifest.version,
    clientVersion,
    fileName: latest.manifest.fileName,
    fileSize: latest.manifest.size,
    fileSizeMB: (latest.manifest.size / (1024 * 1024)).toFixed(1),
    manifest: latest.manifest,
    message: isNewer
      ? `Có bản cập nhật mới: v${latest.manifest.version}`
      : 'Phần mềm đã là phiên bản mới nhất.'
  });
});

// Get update info
app.get('/api/update/info', requireHost, (req, res) => {
  const latest = findLatestSignedUpdate();
  const updatesDir = getUpdatesDir();

  // Try to read release notes if exists
  let releaseNotes = '';
  try {
    const notesPath = path.join(updatesDir, 'RELEASE_NOTES.txt');
    if (fs.existsSync(notesPath)) {
      releaseNotes = fs.readFileSync(notesPath, 'utf8');
    }
  } catch (e) {}

  res.json({
    serverVersion: APP_VERSION,
    latestInstaller: latest ? {
      version: latest.manifest.version,
      fileName: latest.manifest.fileName,
      fileSize: latest.manifest.size,
      fileSizeMB: (latest.manifest.size / (1024 * 1024)).toFixed(1),
      signed: true
    } : null,
    releaseNotes,
    updatesDir
  });
});

// Download the installer file
app.get('/api/update/download', (req, res) => {
  const latest = findLatestSignedUpdate();

  if (!latest) {
    return res.status(404).json({ error: 'Không tìm thấy file cập nhật trên máy chủ.' });
  }

  if (!fs.existsSync(latest.installerPath)) {
    return res.status(404).json({ error: 'File cập nhật không tồn tại.' });
  }

  console.log(`[Auto-Update] Serving signed installer: ${latest.manifest.fileName} (${(latest.manifest.size / (1024 * 1024)).toFixed(1)} MB) to ${req.ip}`);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${latest.manifest.fileName}"`);
  res.setHeader('Content-Length', latest.manifest.size);
  res.setHeader('X-Update-Version', latest.manifest.version);

  const stream = fs.createReadStream(latest.installerPath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[Auto-Update] Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Lỗi khi tải file cập nhật.' });
    }
  });
});

// Broadcast update notification to all connected students via Socket.IO
app.post('/api/update/broadcast', requireHost, (req, res) => {
  const latest = findLatestSignedUpdate();
  if (latest) {
    io.emit('system:update_available', {
      version: latest.manifest.version,
      fileName: latest.manifest.fileName,
      fileSize: latest.manifest.size,
      fileSizeMB: (latest.manifest.size / (1024 * 1024)).toFixed(1),
      signed: true
    });
    console.log(`[Auto-Update] Broadcasted signed update v${latest.manifest.version} to all clients`);
    return res.json({ success: true, broadcasted: true, latest: latest.manifest });
  }
  res.json({ success: false, message: 'Chưa có file cập nhật nào trong thư mục updates.' });
});

// Start Server with graceful EADDRINUSE handling
function startServer(port = 4000) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[SchoolJudge LAN Server] Port ${port} is in use, retrying in 2 seconds...`);
      setTimeout(() => {
        try { server.close(); } catch(e) {}
        server.listen(port, '0.0.0.0');
      }, 2000);
    } else {
      console.error('[SchoolJudge Server Error]', err);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const settings = db.getSettings();
    console.log(`[SchoolJudge LAN Server] Running on http://0.0.0.0:${port}`);
    lan.startHostBeacon({
      name: settings.serverName,
      port
    });
  });
}

module.exports = { app, server, startServer, io };

if (require.main === module) {
  startServer(process.env.PORT || 4000);
}
