const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const db = require('./db.cjs');
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
  const key = req.body?.userId || req.ip || req.connection.remoteAddress;
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

// Socket.IO real-time events
io.on('connection', (socket) => {
  const clientIp = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').replace(/^.*:/, '');

  socket.emit('queue:status', {
    queueLength: queue.queue.length,
    activeWorkers: queue.activeWorkers
  });

  socket.on('client:identify', (data) => {
    if (data && data.userId) {
      onlineUsers.set(socket.id, {
        socketId: socket.id,
        userId: data.userId,
        username: data.username,
        fullName: data.fullName,
        role: data.role || 'user',
        ip: data.ip || clientIp || '127.0.0.1',
        lastSeen: Date.now()
      });
      io.emit('users:online_update', Array.from(onlineUsers.values()));
    }
  });

  socket.on('disconnect', () => {
    if (onlineUsers.has(socket.id)) {
      onlineUsers.delete(socket.id);
      io.emit('users:online_update', Array.from(onlineUsers.values()));
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

app.post('/api/system/setup', (req, res) => {
  if (!db.isFirstRun()) {
    return res.status(400).json({ error: 'Hệ thống đã được khởi tạo tài khoản quản trị trước đó.' });
  }
  const { username, password, fullName, serverName, className } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu không được để trống.' });
  }
  const result = db.setupFirstAdmin({ username, password, fullName, serverName, className });
  res.json({ success: true, user: result.admin, defaultClass: result.defaultClass });
});

// DIAGNOSTICS & SYSTEM STATUS
app.get('/api/diagnostics', (req, res) => {
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
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  io.emit('settings:update', updated);
  res.json(updated);
});

// HELPER: Sanitize problem for students (NEVER return official testCases!)
function sanitizeProblemForStudent(p) {
  if (!p) return null;
  const samples = (p.samples && p.samples.length > 0)
    ? p.samples
    : (p.testCases || []).filter(tc => tc.isSample).map((tc, idx) => ({
        id: `sample-${idx + 1}`,
        name: `Ví dụ ${idx + 1}`,
        input: tc.input || '',
        output: tc.expectedOutput || ''
      }));

  // If no sample was explicitly marked, take first test case as sample demonstration
  if (samples.length === 0 && p.testCases && p.testCases.length > 0) {
    samples.push({
      id: 'sample-1',
      name: 'Ví dụ 1',
      input: p.testCases[0].input || '',
      output: p.testCases[0].expectedOutput || ''
    });
  }

  return {
    id: p.id,
    code: p.code,
    title: p.title,
    difficulty: p.difficulty,
    points: p.points || 100,
    timeLimit: p.timeLimit || 1000,
    memoryLimit: p.memoryLimit || 256,
    category: p.category,
    description: p.description,
    statement: p.statement || '',
    statementHtml: p.statementHtml || '',
    sampleCode: p.sampleCode,
    pdfUrl: p.pdfUrl,
    pdfFileName: p.pdfFileName,
    testCount: (p.testCases || []).length,
    samples: samples,
    testCases: [] // Strictly empty for students! Official test cases are secret on server
  };
}

// PROBLEMS
app.get('/api/problems', (req, res) => {
  const role = req.query.role || 'user';
  const problems = db.getProblems();

  // If user (student), strictly strip official test cases and return only samples
  if (role !== 'host') {
    return res.json(problems.map(p => sanitizeProblemForStudent(p)));
  }

  res.json(problems);
});

app.get('/api/problems/:id', (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Bài tập không tồn tại' });

  const role = req.query.role || 'user';
  if (role !== 'host') {
    return res.json(sanitizeProblemForStudent(prob));
  }

  res.json(prob);
});

app.post('/api/problems', (req, res) => {
  try {
    const prob = db.createProblem(req.body);
    io.emit('problems:update', prob);
    res.json(prob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/problems/:id', (req, res) => {
  const updated = db.updateProblem(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  io.emit('problems:update', updated);
  res.json(updated);
});

app.delete('/api/problems/:id', (req, res) => {
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
app.post('/api/parse-document', async (req, res) => {
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
app.post('/api/problems/:id/pdf', async (req, res) => {
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

    io.emit('problems:update', updated);
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
app.delete('/api/problems/:id/pdf', (req, res) => {
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

  io.emit('problems:update', updated);
  res.json({ success: true, problem: updated });
});

// STATEMENT UPLOAD FOR CONTEST (Đề thi tổng hợp kỳ thi - PDF, Word, Ảnh, Text)
app.post('/api/contests/:id/pdf', async (req, res) => {
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

    io.emit('contest:updated', updated);
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
app.delete('/api/contests/:id/pdf', (req, res) => {
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

  io.emit('contest:updated', updated);
  res.json({ success: true, contest: updated });
});

// LIST AVAILABLE SAMPLE TESTS FROM 'TEST/' DIRECTORY
app.get('/api/sample-tests', (req, res) => {
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
app.post('/api/sample-tests/import', (req, res) => {
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

      io.emit('problems:update', probObj);
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
app.post('/api/problems/:id/import-folder', (req, res) => {
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
  io.emit('problems:update', updated);
  res.json({ success: true, count: finalTestCases.length, problem: updated });
});

// GET TESTCASES ON DEMAND FOR TEACHER (Lazy-loaded, ultra-fast)
app.get('/api/problems/:id/testcases', (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const testCases = db.getProblemTestCases(prob.id);
  res.json(testCases);
});

// DIRECT TESTCASES UPDATE (Add, edit, delete, reorder, score weight, sample toggle)
app.put('/api/problems/:id/testcases', (req, res) => {
  const prob = db.getProblem(req.params.id);
  if (!prob) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const { testCases } = req.body;
  if (!Array.isArray(testCases)) return res.status(400).json({ error: 'Dữ liệu test cases không hợp lệ' });
  const updated = db.updateProblem(prob.id, { testCases });
  io.emit('problems:update', updated);
  res.json({ success: true, count: testCases.length, testCases: updated.testCases });
});

// SUBMISSIONS
app.get('/api/submissions', (req, res) => {
  const { userId, problemId } = req.query;
  const submissions = db.getSubmissions({ userId, problemId });
  res.json(submissions);
});

app.get('/api/submissions/:id', (req, res) => {
  const sub = db.getSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  res.json(sub);
});

// GET FULL RAW TESTCASE DETAILS FOR SUBMISSION (On-demand inspection for teachers)
app.get('/api/submissions/:id/full-test/:testIndex', (req, res) => {
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
  const { userId, userName, problemId, code, contestId, isVirtual, virtualSessionId } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Mã nguồn không được để trống' });
  }

  const settings = db.getSettings();
  if (settings && settings.submissionsClosed) {
    return res.status(403).json({ error: 'Cổng nộp bài hiện đã đóng. Giáo viên không nhận thêm bài nộp.' });
  }

  // If in contest, verify contest status & time (or virtual session)
  let contest = null;
  let virtualSession = null;
  if (isVirtual && virtualSessionId) {
    virtualSession = db.getVirtualSession(virtualSessionId);
    if (!virtualSession) {
      return res.status(400).json({ error: 'Phiên thi ảo không tồn tại' });
    }
    const now = Date.now();
    const end = new Date(virtualSession.endTime).getTime();
    if (virtualSession.status === 'completed' || now > end + 60000) {
      return res.status(403).json({ error: 'Phiên thi ảo đã hết giờ làm bài.' });
    }
    contest = db.getContest(contestId || virtualSession.contestId);
  } else if (contestId) {
    contest = db.getContest(contestId);
    if (contest) {
      // Verify IP Whitelist if set by teacher
      if (contest.ipWhitelist && contest.ipWhitelist.trim()) {
        const clientIp = (req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || '').replace(/^.*:/, '');
        if (!isIpAllowed(clientIp, contest.ipWhitelist)) {
          return res.status(403).json({
            error: `Địa chỉ IP của máy bạn (${clientIp}) không nằm trong dải IP phòng thi được phép nộp bài (${contest.ipWhitelist}). Vui lòng liên hệ giám thị.`
          });
        }
      }

      const now = Date.now();
      const end = new Date(contest.endTime).getTime();
      if (contest.status === 'ended' || now > end) {
        return res.status(403).json({ error: 'Kỳ thi đã kết thúc. Không thể nộp bài thêm.' });
      }
    }
  }

  let rawCode = String(req.body.problemCode || problemId || req.body.filename || '').trim();
  let cleanCode = rawCode.replace(/\.(cpp|pas|py|c|java|txt)$/i, '').trim().toLowerCase();

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
  if (!prob && cleanCode) {
    // Search all problems in db by code case-insensitively
    prob = db.getProblems().find(p => p.code?.toLowerCase() === cleanCode);
  }
  if (!prob) {
    return res.status(404).json({ error: 'Không tìm thấy bài tập tương ứng để chấm (Tên bài không khớp với đề thi)' });
  }

  const sub = db.createSubmission({
    userId,
    userName,
    problemId: prob.id,
    problemCode: prob.code,
    code,
    totalTests: (prob.testCases || []).length,
    contestId: contestId || (virtualSession ? virtualSession.contestId : null),
    isVirtual: !!isVirtual,
    virtualSessionId: virtualSessionId || null,
    requireFreopen: !!contest?.requireFreopen
  });

  // Check submission mode: direct vs batch (chế độ nộp bài)
  // In virtual mode, always grade directly so student gets immediate feedback!
  const isBatchMode = !isVirtual && ((contest && contest.gradingMode === 'batch_after_deadline') || (settings && settings.submissionMode === 'batch'));
  if (!isBatchMode) {
    queue.enqueue(sub.id);
  }

  io.emit('submission:created', sub);
  res.json({
    ...sub,
    mode: isBatchMode ? 'batch' : 'direct',
    note: isBatchMode ? 'Bài nộp đã được ghi nhận trong kỳ thi. Kết quả sẽ được công bố sau khi kết thúc giờ làm bài.' : undefined
  });
});

// Toggle submission portal open/close
app.post('/api/submissions/toggle-close', (req, res) => {
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

app.post('/api/grade-all', async (req, res) => {
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

app.delete('/api/grade-all/cancel', (req, res) => {
  if (batchGradeJob) {
    batchGradeJob.cancel = true;
    res.json({ message: 'Hủy đang được xử lý...' });
  } else {
    res.json({ message: 'Không có tác vụ chấm hàng loạt nào đang chạy.' });
  }
});

// ─── CONTESTS APIS ────────────────────────────────────────────────────────
app.get('/api/contests', (req, res) => {
  const { role, classId } = req.query;
  let contests = db.getContests();
  const now = Date.now();

  // Dynamic status check
  contests = contests.map(c => {
    let status = c.status;
    const start = new Date(c.startTime).getTime();
    const end = new Date(c.endTime).getTime();
    if (status !== 'ended') {
      if (now < start) status = 'upcoming';
      else if (now >= start && now <= end) status = 'running';
      else if (now > end) status = 'ended';
    }
    return { ...c, status };
  });

  if (role !== 'host' && classId) {
    contests = contests.filter(c => !c.classIds || c.classIds.length === 0 || c.classIds.includes(classId));
  }

  res.json(contests);
});

app.get('/api/contests/:id', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  
  const isHost = req.query.role === 'host';
  const rawProblems = (contest.problemIds || []).map(pId => db.getProblem(pId)).filter(Boolean);
  const problems = rawProblems.map(p => {
    if (isHost) return p;
    // For students: strictly sanitize hidden testcases! Only return samples and metadata
    return sanitizeProblemForStudent(p);
  });
  
  const now = Date.now();
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  let status = contest.status;
  if (status !== 'ended') {
    if (now < start) status = 'upcoming';
    else if (now >= start && now <= end) status = 'running';
    else if (now > end) status = 'ended';
  }

  res.json({ ...contest, status, problems });
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

app.post('/api/contests', (req, res) => {
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
    io.emit('contest:created', contest);
    res.json(contest);
  } catch (err) {
    console.error('[Create Contest Error]', err);
    res.status(500).json({ error: err.message || 'Lỗi khi lưu kỳ thi trên máy chủ' });
  }
});

app.put('/api/contests/:id', (req, res) => {
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
    io.emit('contest:updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('[Update Contest Error]', err);
    res.status(500).json({ error: err.message || 'Lỗi khi cập nhật kỳ thi trên máy chủ' });
  }
});

app.delete('/api/contests/:id', (req, res) => {
  const ok = db.deleteContest(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  io.emit('contest:deleted', { id: req.params.id });
  res.json({ success: true });
});

app.post('/api/contests/:id/toggle-status', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  const { status } = req.body; // 'running' | 'ended' | 'upcoming'
  const updated = db.updateContest(req.params.id, { status });
  io.emit('contest:updated', updated);
  res.json(updated);
});

app.get('/api/contests/:id/leaderboard', (req, res) => {
  const isVirtual = req.query.virtual === 'true';
  const leaderboard = db.getContestLeaderboard(req.params.id, isVirtual);
  res.json(leaderboard);
});

// ─── VIRTUAL PARTICIPATION (THI ẢO) ─────────────────────────────────────────
app.post('/api/contests/:id/virtual-start', (req, res) => {
  const contest = db.getContest(req.params.id);
  if (!contest) return res.status(404).json({ error: 'Kỳ thi không tồn tại' });
  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu thông tin người dùng' });

  const session = db.createVirtualSession({
    userId,
    userName: userName || 'Học sinh',
    contestId: contest.id,
    durationMinutes: contest.durationMinutes
  });
  res.json(session);
});

app.get('/api/contests/:id/virtual-sessions', (req, res) => {
  const { userId } = req.query;
  const sessions = db.getVirtualSessions({ contestId: req.params.id, userId });
  res.json(sessions);
});

app.post('/api/virtual-sessions/:id/finish', (req, res) => {
  const finished = db.finishVirtualSession(req.params.id);
  if (!finished) return res.status(404).json({ error: 'Phiên thi ảo không tồn tại' });
  res.json(finished);
});

app.get('/api/contests/:id/virtual-leaderboard', (req, res) => {
  const board = db.getContestLeaderboard(req.params.id, true);
  res.json(board);
});

// CONTEST ATTENDANCE & ROOM CONTROL
app.get('/api/contests/:id/attendance', (req, res) => {
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

app.post('/api/contests/:id/attendance', (req, res) => {
  const { userId, status, reason, extraMinutes } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.updateContestAttendance(req.params.id, userId, { status, reason, extraMinutes });
  io.emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json(updated);
});

app.post('/api/contests/:id/candidates', (req, res) => {
  const { candidateIds } = req.body;
  if (!Array.isArray(candidateIds)) return res.status(400).json({ error: 'Danh sách candidateIds không hợp lệ' });
  const contest = db.updateContestCandidates(req.params.id, candidateIds);
  if (!contest) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });
  io.emit('contest:candidates_updated', { contestId: req.params.id, candidateIds });
  res.json({ success: true, count: candidateIds.length, contest });
});

app.post('/api/contests/:id/extra-time', (req, res) => {
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
  
  io.emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, extraMinutes, totalExtraMinutes: updated.extraMinutes });
});

app.post('/api/contests/:id/reopen', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.reopenContestForUser(req.params.id, userId);

  // Realtime notify student
  for (const [sockId, client] of onlineUsers.entries()) {
    if (client.userId === userId) {
      io.to(sockId).emit('contest:reopened', { contestId: req.params.id });
    }
  }

  io.emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, message: 'Đã mở lại lượt thi thành công' });
});

app.post('/api/contests/:id/suspend', (req, res) => {
  const { userId, reason = 'Vi phạm quy chế phòng thi' } = req.body;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });
  const updated = db.updateContestAttendance(req.params.id, userId, { status: 'suspended', reason });

  // Realtime notify student
  for (const [sockId, client] of onlineUsers.entries()) {
    if (client.userId === userId) {
      io.to(sockId).emit('contest:suspended', { contestId: req.params.id, reason });
    }
  }

  io.emit('contest:attendance_changed', { contestId: req.params.id, userId, ...updated });
  res.json({ success: true, message: 'Đã đình chỉ bài thi của học sinh' });
});

// CLASSES & USERS
app.get('/api/classes', (req, res) => {
  res.json(db.getClasses());
});

app.post('/api/classes', (req, res) => {
  const cls = db.createClass(req.body);
  res.json(cls);
});

app.get('/api/users', (req, res) => {
  res.json(db.getUsers());
});

app.post('/api/users', (req, res) => {
  const user = db.createUser(req.body);
  res.json(user);
});

// BATCH CREATE STUDENTS
app.post('/api/users/batch', (req, res) => {
  const { students, classId } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'Danh sách học sinh không hợp lệ' });
  }

  const created = [];
  const existingUsers = db.getUsers();

  for (const s of students) {
    const cleanUser = (s.username || '').trim().toLowerCase();
    if (!cleanUser) continue;

    let user = existingUsers.find(u => u.username === cleanUser);
    if (!user) {
      user = db.createUser({
        username: cleanUser,
        password: s.password || '123456',
        fullName: s.fullName || cleanUser,
        role: 'user',
        classId: s.classId || classId || (db.getClasses()[0]?.id || 'cls-1')
      });
      created.push(user);
      existingUsers.push(user);
    }
  }

  res.json({ success: true, count: created.length, created });
});

// RESET STUDENT PASSWORD
app.put('/api/users/:id/reset-password', (req, res) => {
  const { newPassword = '123456' } = req.body;
  const user = db.resetUserPassword(req.params.id, newPassword);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ success: true, message: 'Đã đặt lại mật khẩu thành công', user });
});

// ONLINE USERS
app.get('/api/users/online', (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

// UPDATE USER DETAILS
app.put('/api/users/:id', (req, res) => {
  const updated = db.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json(updated);
});

// TOGGLE USER LOCK
app.post('/api/users/:id/toggle-lock', (req, res) => {
  const updated = db.toggleUserLock(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  
  // If user is locked, disconnect any active sockets
  if (updated.isLocked) {
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

  res.json(updated);
});

// GET USER EXAM HISTORY & PORTFOLIO
app.get('/api/users/:id/history', (req, res) => {
  const history = db.getUserExamHistory(req.params.id);
  res.json(history);
});

// DELETE STUDENT ACCOUNT
app.delete('/api/users/:id', (req, res) => {
  const user = db.getUser(req.params.id);
  if (user && user.role === 'host') {
    return res.status(403).json({ error: 'Không thể xóa tài khoản Quản trị viên (Admin)' });
  }
  const ok = db.deleteUser(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json({ success: true });
});

// AUTHENTICATION WITH BRUTE-FORCE PROTECTION
app.post('/api/auth/login', loginRateLimiter, (req, res) => {
  const { username, password, fullName, classId } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  if (!username) return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập' });

  let user = db.authenticate(username, password || '');

  // If user doesn't exist and system already has an admin, check if student can auto-join
  if (!user && !db.isFirstRun()) {
    const existing = db.getUser(username);
    if (!existing) {
      // Auto register student with class
      user = db.createUser({
        username,
        password: password || '123456',
        fullName: fullName || username,
        role: 'user',
        classId: classId || (db.getClasses()[0]?.id || 'cls-1')
      });
    } else {
      // Existing user but password failed
      const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      record.count++;
      if (record.count >= 5) {
        record.lockedUntil = Date.now() + 5 * 60 * 1000;
        loginAttempts.set(ip, record);
        return res.status(429).json({ error: 'Đăng nhập sai quá 5 lần. IP tạm thời bị khóa trong 5 phút.' });
      }
      loginAttempts.set(ip, record);
      return res.status(401).json({ error: `Sai mật khẩu! (Lần ${record.count}/5)` });
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc sai thông tin đăng nhập' });
  }

  if (user.isLocked) {
    return res.status(403).json({ error: 'Tài khoản của bạn đã bị tạm khóa bởi giáo viên. Vui lòng liên hệ giám thị phòng máy.' });
  }

  // Clear attempts on success
  loginAttempts.delete(ip);
  res.json(user);
});

// ANTI-CHEAT PLAGIARISM CHECKER
app.get('/api/anticheat/scan/:problemId', (req, res) => {
  const threshold = Number(req.query.threshold) || 60;
  const results = antiCheat.scanProblemSubmissions(req.params.problemId, threshold);
  res.json(results);
});

// EXPORT REPORT (CSV)
app.get('/api/export/csv', (req, res) => {
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
app.get('/api/contests/:id/official-report', (req, res) => {
  const report = db.getOfficialContestReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy kỳ thi' });
  res.json(report);
});

app.get('/api/contests/:id/export-official-csv', (req, res) => {
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

function findLatestInstaller() {
  const updatesDir = getUpdatesDir();
  try {
    const files = fs.readdirSync(updatesDir)
      .filter(f => f.endsWith('.exe'))
      .map(f => {
        const stat = fs.statSync(path.join(updatesDir, f));
        // Try to extract version from filename like "SchoolJudge LAN_Setup_1.0.9.exe"
        const versionMatch = f.match(/(\d+\.\d+\.\d+)/);
        return {
          fileName: f,
          filePath: path.join(updatesDir, f),
          size: stat.size,
          version: versionMatch ? versionMatch[1] : null,
          mtime: stat.mtime
        };
      })
      .filter(f => f.version)
      .sort((a, b) => {
        // Sort by semantic version descending
        const va = a.version.split('.').map(Number);
        const vb = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if ((va[i] || 0) !== (vb[i] || 0)) return (vb[i] || 0) - (va[i] || 0);
        }
        return b.mtime - a.mtime;
      });
    return files.length > 0 ? files[0] : null;
  } catch (e) {
    return null;
  }
}

function compareVersions(v1, v2) {
  const a = (v1 || '0.0.0').split('.').map(Number);
  const b = (v2 || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
}

// Check for updates - called by Student machines
app.get('/api/update/check', (req, res) => {
  const clientVersion = req.query.version || '0.0.0';
  const latest = findLatestInstaller();

  if (!latest) {
    return res.json({
      updateAvailable: false,
      currentVersion: APP_VERSION,
      clientVersion,
      message: 'Không có bản cập nhật nào trên máy chủ.'
    });
  }

  const isNewer = compareVersions(latest.version, clientVersion) > 0;

  res.json({
    updateAvailable: isNewer,
    currentVersion: APP_VERSION,
    latestVersion: latest.version,
    clientVersion,
    fileName: latest.fileName,
    fileSize: latest.size,
    fileSizeMB: (latest.size / (1024 * 1024)).toFixed(1),
    message: isNewer
      ? `Có bản cập nhật mới: v${latest.version}`
      : 'Phần mềm đã là phiên bản mới nhất.'
  });
});

// Get update info
app.get('/api/update/info', (req, res) => {
  const latest = findLatestInstaller();
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
      version: latest.version,
      fileName: latest.fileName,
      fileSize: latest.size,
      fileSizeMB: (latest.size / (1024 * 1024)).toFixed(1)
    } : null,
    releaseNotes,
    updatesDir
  });
});

// Download the installer file
app.get('/api/update/download', (req, res) => {
  const latest = findLatestInstaller();

  if (!latest) {
    return res.status(404).json({ error: 'Không tìm thấy file cập nhật trên máy chủ.' });
  }

  if (!fs.existsSync(latest.filePath)) {
    return res.status(404).json({ error: 'File cập nhật không tồn tại.' });
  }

  console.log(`[Auto-Update] Serving installer: ${latest.fileName} (${(latest.size / (1024 * 1024)).toFixed(1)} MB) to ${req.ip}`);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${latest.fileName}"`);
  res.setHeader('Content-Length', latest.size);
  res.setHeader('X-Update-Version', latest.version);

  const stream = fs.createReadStream(latest.filePath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[Auto-Update] Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Lỗi khi tải file cập nhật.' });
    }
  });
});

// Broadcast update notification to all connected students via Socket.IO
app.post('/api/update/broadcast', (req, res) => {
  const latest = findLatestInstaller();
  if (latest) {
    io.emit('system:update_available', {
      version: latest.version,
      fileName: latest.fileName,
      fileSize: latest.size,
      fileSizeMB: (latest.size / (1024 * 1024)).toFixed(1)
    });
    console.log(`[Auto-Update] Broadcasted new update v${latest.version} to all clients`);
    return res.json({ success: true, broadcasted: true, latest });
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
