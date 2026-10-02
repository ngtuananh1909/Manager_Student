const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_ACHIEVEMENTS, DEFAULT_REWARDS } = require('./achievementsData.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getDataDir() {
  if (process.env.SCHOOLJUDGE_DATA_DIR) {
    const configuredPath = path.resolve(process.env.SCHOOLJUDGE_DATA_DIR);
    if (!fs.existsSync(configuredPath)) fs.mkdirSync(configuredPath, { recursive: true });
    return configuredPath;
  }

  try {
    const electron = require('electron');
    const app = electron.app || electron.remote?.app;
    if (app && typeof app.getPath === 'function') {
      const userPath = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
      return userPath;
    }
  } catch (e) {}

  if (process.env.APPDATA) {
    const appDataPath = path.join(process.env.APPDATA, 'chaucaojudge', 'data');
    if (fs.existsSync(appDataPath)) return appDataPath;
    const oldAppDataPath = path.join(process.env.APPDATA, 'quan-ly-code', 'data');
    if (fs.existsSync(oldAppDataPath)) return oldAppDataPath;
  }
  return process.cwd();
}

const DATA_DIR = getDataDir();
const DATA_FILE = path.join(DATA_DIR, 'schooljudge_data.json');

// Auto-migrate from process.cwd() if exists and new location is empty
if (DATA_DIR !== process.cwd() && !fs.existsSync(DATA_FILE)) {
  const oldPath = path.join(process.cwd(), 'schooljudge_data.json');
  if (fs.existsSync(oldPath)) {
    try {
      fs.copyFileSync(oldPath, DATA_FILE);
    } catch (e) {}
  }
}

// Empty initial database template (Completely blank as required)
const BLANK_DATA = {
  settings: {
    serverName: "ChauCaoJudge LAN - Máy Chủ Chấm Bài C++",
    port: 4000,
    compilerPath: "g++",
    useDocker: false,
    dockerImage: "gcc:latest",
    globalMemoryLimit: 256, // System-wide default memory limit: 256MB
    contestMode: false,
    contestEndTime: null,
    freezeScoreboard: false,
    allowCustomRun: true,
    submissionMode: 'direct',
    submissionsClosed: false
  },
  classes: [],
  users: [],
  problems: [],
  submissions: [],
  contests: [],
  virtual_sessions: [],
  contest_attendance: {},
  achievements: DEFAULT_ACHIEVEMENTS,
  rewards: DEFAULT_REWARDS,
  student_achievements: [],
  reward_redemptions: []
};

const TESTCASES_DIR = path.join(DATA_DIR, 'testcases');
if (!fs.existsSync(TESTCASES_DIR)) {
  try { fs.mkdirSync(TESTCASES_DIR, { recursive: true }); } catch (e) {}
}

class Database {
  constructor() {
    this.DATA_DIR = DATA_DIR;
    this.TESTCASES_DIR = TESTCASES_DIR;
    this._testCasesCache = new Map();
    this._saveTimer = null;
    this.data = this.load();

    // Flush pending changes on process exit or crash
    const handleExit = () => {
      this.flushSync();
    };
    process.on('beforeExit', handleExit);
    process.on('exit', handleExit);
    process.on('SIGINT', () => { handleExit(); process.exit(0); });
    process.on('SIGTERM', () => { handleExit(); process.exit(0); });
    process.on('uncaughtException', (err) => {
      console.error('FATAL UNCAUGHT EXCEPTION - Auto-flushing database:', err);
      try { this.flushSync(); } catch (e) {}
    });
    process.on('unhandledRejection', (reason) => {
      console.error('FATAL UNHANDLED REJECTION - Auto-flushing database:', reason);
      try { this.flushSync(); } catch (e) {}
    });
  }

  hashPassword(password) {
    if (!password) return '';
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Get testcases from memory cache or individual testcase file on disk
  getProblemTestCases(problemId) {
    if (!problemId) return [];
    if (this._testCasesCache.has(problemId)) {
      return this._testCasesCache.get(problemId);
    }
    const tcFile = path.join(this.TESTCASES_DIR, `${problemId}.json`);
    if (fs.existsSync(tcFile)) {
      try {
        const raw = fs.readFileSync(tcFile, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this._testCasesCache.set(problemId, list);
          return list;
        }
      } catch (e) {
        console.error(`Error reading testcases for ${problemId}:`, e);
      }
    }
    return [];
  }

  // Save testcases into dedicated file atomically and update in-memory cache
  setProblemTestCases(problemId, testCases) {
    if (!problemId) return;
    const list = Array.isArray(testCases) ? testCases : [];
    this._testCasesCache.set(problemId, list);
    
    // Save to testcases/<problemId>.json atomically using .tmp rename
    const tcFile = path.join(this.TESTCASES_DIR, `${problemId}.json`);
    const tmpFile = `${tcFile}.tmp`;
    try {
      fs.writeFileSync(tmpFile, JSON.stringify(list), 'utf8');
      fs.renameSync(tmpFile, tcFile);
    } catch (e) {
      try {
        fs.writeFileSync(tcFile, JSON.stringify(list), 'utf8');
      } catch (err) {
        console.error(`Error saving testcase file for ${problemId}:`, err);
      }
    }

    // Sync testCount in problem object
    const prob = this.data.problems?.find(p => p.id === problemId);
    if (prob) {
      prob.testCount = list.length;
    }
  }

  // Attach transparent getter/setter so prob.testCases works seamlessly for backend/judge
  // but is non-enumerable so JSON.stringify(this.data) remains super small (<30KB instead of 25MB)
  attachTestCaseProperty(prob) {
    if (!prob || !prob.id) return;
    const self = this;
    Object.defineProperty(prob, 'testCases', {
      get() {
        return self.getProblemTestCases(prob.id);
      },
      set(val) {
        self.setProblemTestCases(prob.id, val);
      },
      enumerable: false,
      configurable: true
    });
  }

  load() {
    let parsed = null;
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        parsed = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading DB, initializing blank database:', err);
    }

    if (!parsed) {
      parsed = JSON.parse(JSON.stringify(BLANK_DATA));
    }

    if (!parsed.settings) parsed.settings = { ...BLANK_DATA.settings };
    if (parsed.settings.submissionMode === undefined) parsed.settings.submissionMode = 'direct';
    if (parsed.settings.submissionsClosed === undefined) parsed.settings.submissionsClosed = false;
    if (!parsed.problems) parsed.problems = [];
    if (!parsed.contests) parsed.contests = [];
    if (!parsed.virtual_sessions) parsed.virtual_sessions = [];
    if (!parsed.contest_attendance) parsed.contest_attendance = {};
    if (!parsed.achievements || !Array.isArray(parsed.achievements) || parsed.achievements.length === 0) {
      parsed.achievements = JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS));
    }
    if (!parsed.rewards || !Array.isArray(parsed.rewards) || parsed.rewards.length === 0) {
      parsed.rewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
    }
    if (!parsed.student_achievements) parsed.student_achievements = [];
    if (!parsed.reward_redemptions) parsed.reward_redemptions = [];

    // Auto-migrate heavy testCases out of schooljudge_data.json into testcases/ directory
    let migratedAny = false;
    for (const prob of parsed.problems) {
      if (Array.isArray(prob.testCases) && prob.testCases.length > 0) {
        // Has inline testcases, save to dedicated file
        const tcFile = path.join(this.TESTCASES_DIR, `${prob.id}.json`);
        try {
          fs.writeFileSync(tcFile, JSON.stringify(prob.testCases), 'utf8');
          this._testCasesCache.set(prob.id, prob.testCases);
          prob.testCount = prob.testCases.length;
          migratedAny = true;
        } catch (e) {
          console.error(`Migration error for problem ${prob.id}:`, e);
        }
      } else if (prob.testCount === undefined) {
        const existing = this.getProblemTestCases(prob.id);
        prob.testCount = existing.length;
      }
      // Strip inline testCases from enumerable keys to reduce file from 25MB -> 6KB
      delete prob.testCases;
      this.attachTestCaseProperty(prob);
    }

    if (migratedAny) {
      console.log('⚡ Successfully extracted heavy testcases to testcases/ folder. Database size optimized!');
      this.flushSync(parsed);
    }

    return parsed;
  }

  // Debounced non-blocking save
  save(dataToSave = this.data) {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.flushSync(dataToSave);
    }, 150);
  }

  // Immediate synchronous flush for critical persistence (e.g. shutdown, admin creation)
  flushSync(dataToSave = this.data) {
    try {
      if (this._saveTimer) {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
      }

      // Prepare clean data ensuring testCases are not serialized into main DB file
      const cleanData = {
        ...dataToSave,
        problems: (dataToSave.problems || []).map(p => {
          const count = p.testCount !== undefined 
            ? p.testCount 
            : (Array.isArray(p.testCases) ? p.testCases.length : this.getProblemTestCases(p.id).length);
          const copy = { ...p, testCount: count };
          delete copy.testCases;
          return copy;
        })
      };

      // Write atomically using .tmp and rename to prevent file corruption on sudden crash
      const tmpFile = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(cleanData), 'utf8');
      fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
      console.error('Error writing DB file atomically:', err);
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave), 'utf8');
      } catch (fallbackErr) {
        console.error('Fallback DB write also failed:', fallbackErr);
      }
    }
  }

  // First Run Check
  isFirstRun() {
    const hasAdmin = this.data.users.some(u => u.role === 'host' || u.role === 'admin');
    return !hasAdmin;
  }

  setupFirstAdmin(adminData) {
    if (!adminData.passwordHash) {
      const error = new Error('A pre-hashed password is required');
      error.code = 'PASSWORD_HASH_REQUIRED';
      throw error;
    }
    const admin = {
      id: newId('usr'),
      username: adminData.username.trim().toLowerCase(),
      passwordHash: adminData.passwordHash,
      fullName: adminData.fullName || "Quản trị viên / Giáo viên",
      role: 'host',
      classId: 'admin-class',
      createdAt: new Date().toISOString()
    };

    if (adminData.serverName) {
      this.data.settings.serverName = adminData.serverName.trim();
    }

    this.data.users = [admin];

    // Seed a default class for students
    const defaultClass = {
      id: newId('cls'),
      name: adminData.className || "Lớp Tin Học 1",
      teacher: admin.fullName,
      joinCode: "TIN01"
    };
    this.data.classes = [defaultClass];

    this.flushSync();
    return { admin, defaultClass };
  }

  // Settings
  getSettings() { return this.data.settings; }
  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  // Problems
  getProblems(options = {}) {
    // If includeTestCases is explicitly requested, return full testcases
    // Otherwise return lightweight problems with testCount & metadata
    return this.data.problems.map(p => {
      const tcs = this.getProblemTestCases(p.id);
      return {
        ...p,
        testCount: p.testCount !== undefined ? p.testCount : tcs.length,
        testCases: options.includeTestCases 
          ? tcs 
          : tcs.map(tc => ({ id: tc.id, name: tc.name, score: tc.score, isSample: tc.isSample }))
      };
    });
  }

  getProblem(id, options = {}) {
    const prob = this.data.problems.find(p => p.id === id || p.code === id);
    if (!prob) return null;
    const tcs = this.getProblemTestCases(prob.id);
    return {
      ...prob,
      testCount: prob.testCount !== undefined ? prob.testCount : tcs.length,
      testCases: options.includeTestCases === false 
        ? tcs.map(tc => ({ id: tc.id, name: tc.name, score: tc.score, isSample: tc.isSample }))
        : tcs
    };
  }
  
  createProblem(prob) {
    if (!this.data.problems) this.data.problems = [];
    const globalMem = this.data.settings?.globalMemoryLimit || 256;
    const probId = newId('prob');
    const rawTestCases = Array.isArray(prob.testCases) ? prob.testCases : [];
    
    // Save testcases to dedicated storage
    this.setProblemTestCases(probId, rawTestCases);

    const newProb = {
      id: probId,
      code: String(prob.code || 'BAI').toUpperCase().trim(),
      title: String(prob.title || prob.code || 'Bài tập').trim(),
      difficulty: prob.difficulty || "Trung bình",
      points: Number(prob.points) || 100,
      timeLimit: Number(prob.timeLimit) || 1000,
      memoryLimit: Number(prob.memoryLimit) || globalMem,
      category: prob.category || "C++11",
      description: prob.description || "",
      statement: prob.statement || "",
      statementHtml: prob.statementHtml || "",
      samples: Array.isArray(prob.samples) ? prob.samples : [],
      sampleCode: prob.sampleCode || `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Code C++11\n    return 0;\n}\n`,
      pdfUrl: prob.pdfUrl || "",
      pdfFileName: prob.pdfFileName || "",
      testCount: rawTestCases.length
    };

    this.attachTestCaseProperty(newProb);
    this.data.problems.push(newProb);
    this.flushSync();
    return { ...newProb, testCases: rawTestCases };
  }

  updateProblem(id, updates) {
    const idx = this.data.problems.findIndex(p => p.id === id);
    if (idx !== -1) {
      if (updates.testCases !== undefined) {
        this.setProblemTestCases(id, updates.testCases);
        updates.testCount = updates.testCases.length;
        delete updates.testCases;
      }

      this.data.problems[idx] = { 
        ...this.data.problems[idx], 
        ...updates,
        points: updates.points !== undefined ? Number(updates.points) : this.data.problems[idx].points,
        timeLimit: updates.timeLimit !== undefined ? Number(updates.timeLimit) : this.data.problems[idx].timeLimit,
        memoryLimit: updates.memoryLimit !== undefined ? Number(updates.memoryLimit) : (this.data.problems[idx].memoryLimit || 256)
      };
      this.attachTestCaseProperty(this.data.problems[idx]);
      this.flushSync();
      return this.getProblem(id);
    }
    return null;
  }

  deleteProblem(id) {
    this.data.problems = this.data.problems.filter(p => p.id !== id);
    this._testCasesCache.delete(id);
    const tcFile = path.join(this.TESTCASES_DIR, `${id}.json`);
    try {
      if (fs.existsSync(tcFile)) fs.unlinkSync(tcFile);
    } catch (e) {}
    this.flushSync();
    return true;
  }

  // Users & Auth
  getUsers() { return this.data.users; }
  getUser(id) { return this.data.users.find(u => u.id === id || u.username === id); }
  
  createUser(user) {
    if (!user.passwordHash) {
      const error = new Error('A pre-hashed password is required');
      error.code = 'PASSWORD_HASH_REQUIRED';
      throw error;
    }
    const classes = Array.isArray(user.classes) && user.classes.length > 0
      ? user.classes
      : (user.classId ? [user.classId] : [this.data.classes[0]?.id || "cls-1"]);
    const newUser = {
      id: newId('usr'),
      username: user.username.trim().toLowerCase(),
      passwordHash: user.passwordHash,
      fullName: user.fullName || user.username,
      role: user.role || "user",
      classId: classes[0] || (this.data.classes[0]?.id || "cls-1"),
      classes: classes,
      streak: 1,
      badges: [],
      isLocked: false,
      mustChangePassword: !!user.mustChangePassword,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  toggleUserLock(id) {
    const user = this.data.users.find(u => u.id === id || u.username === id);
    if (user) {
      user.isLocked = !user.isLocked;
      this.save();
      return user;
    }
    return null;
  }

  updateUser(id, updates = {}) {
    const user = this.data.users.find(u => u.id === id || u.username === id);
    if (user) {
      if (updates.fullName) user.fullName = updates.fullName.trim();
      if (updates.classId) user.classId = updates.classId;
      if (updates.classes && Array.isArray(updates.classes)) {
        user.classes = updates.classes;
        if (!user.classId && updates.classes.length > 0) user.classId = updates.classes[0];
      } else if (updates.classId && (!user.classes || user.classes.length === 0)) {
        user.classes = [updates.classId];
      }
      if (updates.isLocked !== undefined) user.isLocked = !!updates.isLocked;
      this.save();
      return user;
    }
    return null;
  }

  setUserPasswordHash(id, passwordHash, mustChangePassword = false) {
    if (!passwordHash) {
      const error = new Error('A pre-hashed password is required');
      error.code = 'PASSWORD_HASH_REQUIRED';
      throw error;
    }
    const user = this.data.users.find(u => u.id === id || u.username === id);
    if (user) {
      user.passwordHash = passwordHash;
      user.mustChangePassword = !!mustChangePassword;
      this.save();
      return user;
    }
    return null;
  }

  deleteUser(id) {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id && u.username !== id);
    if (this.data.users.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  authenticate(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const user = this.data.users.find(u => u.username === cleanUser);
    if (!user) return null;

    const hash = this.hashPassword(password);
    if (user.passwordHash && user.passwordHash !== hash) {
      return null;
    }
    return user;
  }

  // Classes
  getClasses() { return this.data.classes; }
  createClass(cls) {
    const name = cls.name.trim();
    const autoGrade = parseInt(name.match(/\d+/)?.[0] || '0', 10) || null;
    const newClass = {
      id: newId('cls'),
      name,
      grade: cls.grade !== undefined && cls.grade !== null && cls.grade !== '' ? Number(cls.grade) : autoGrade,
      teacher: cls.teacher || "Giáo viên",
      joinCode: (cls.joinCode || Math.random().toString(36).substring(2, 8)).toUpperCase()
    };
    this.data.classes.push(newClass);
    this.save();
    return newClass;
  }

  // Submissions
  getSubmissions(filter = {}) {
    let list = [...this.data.submissions];
    if (filter.userId) list = list.filter(s => s.userId === filter.userId);
    if (filter.problemId) list = list.filter(s => s.problemId === filter.problemId);
    if (filter.contestId) list = list.filter(s => s.contestId === filter.contestId);
    if (filter.virtualSessionId) list = list.filter(s => s.virtualSessionId === filter.virtualSessionId);
    if (filter.isVirtual !== undefined) {
      const isVirt = filter.isVirtual === 'true' || filter.isVirtual === true;
      list = list.filter(s => !!s.isVirtual === isVirt);
    }
    if (filter.participationType) {
      const pType = String(filter.participationType).toUpperCase();
      if (pType === 'REAL') {
        list = list.filter(s => !s.isVirtual && s.participationType !== 'VIRTUAL');
      } else if (pType === 'VIRTUAL') {
        list = list.filter(s => !!s.isVirtual || s.participationType === 'VIRTUAL');
      }
    }
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  getSubmission(id) {
    return this.data.submissions.find(s => s.id === id);
  }

  createSubmission(sub) {
    const newSub = {
      id: newId('sub'),
      userId: sub.userId,
      userName: sub.userName || "Học sinh",
      problemId: sub.problemId,
      problemCode: sub.problemCode,
      code: sub.code,
      status: "QUEUED",
      score: 0,
      passedTests: 0,
      totalTests: sub.totalTests || 0,
      executionTime: 0,
      memoryUsed: 0,
      submittedAt: new Date().toISOString(),
      details: [],
      contestId: sub.contestId || null,
      isVirtual: !!sub.isVirtual || sub.participationType === 'VIRTUAL',
      participationType: (!!sub.isVirtual || sub.participationType === 'VIRTUAL') ? 'VIRTUAL' : 'REAL',
      virtualSessionId: sub.virtualSessionId || null
    };
    this.data.submissions.unshift(newSub);
    this.save();
    return newSub;
  }

  updateSubmission(id, updates) {
    const idx = this.data.submissions.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.submissions[idx] = { ...this.data.submissions[idx], ...updates };
      const finalStatuses = ['AC', 'WA', 'TLE', 'MLE', 'CE', 'RE', 'SKIPPED'];
      if (updates.status && finalStatuses.includes(updates.status)) {
        this.flushSync();
      } else {
        this.save();
      }
      return this.data.submissions[idx];
    }
    return null;
  }

  // Leaderboard
  getLeaderboard() {
    const userMap = {};
    for (const u of this.data.users.filter(u => u.role === 'user')) {
      userMap[u.id] = {
        userId: u.id,
        userName: u.fullName,
        username: u.username,
        classId: u.classId,
        totalScore: 0,
        problemsSolved: 0,
        totalSubmissions: 0,
        solvedProblems: {},
        badges: u.badges || []
      };
    }

    for (const sub of this.data.submissions) {
      if (!userMap[sub.userId]) continue;
      userMap[sub.userId].totalSubmissions++;
      const currentScore = userMap[sub.userId].solvedProblems[sub.problemId]?.score || 0;
      if (sub.score > currentScore) {
        userMap[sub.userId].solvedProblems[sub.problemId] = {
          score: sub.score,
          status: sub.status,
          time: sub.executionTime
        };
      }
    }

    const leaderboard = Object.values(userMap).map(u => {
      let total = 0;
      let solved = 0;
      for (const pId in u.solvedProblems) {
        total += u.solvedProblems[pId].score;
        if (u.solvedProblems[pId].status === 'AC') solved++;
      }
      return {
        ...u,
        totalScore: total,
        problemsSolved: solved
      };
    });

    return leaderboard.sort((a, b) => b.totalScore - a.totalScore || b.problemsSolved - a.problemsSolved);
  }

  // ─── Contests Management ──────────────────────────────────────────────────
  getContests() {
    return this.data.contests || [];
  }

  getContest(id) {
    return (this.data.contests || []).find(c => c.id === id);
  }

  createContest(contest) {
    if (!this.data.contests) this.data.contests = [];
    const targetClasses = Array.isArray(contest.targetClasses) 
      ? contest.targetClasses 
      : (Array.isArray(contest.classIds) ? contest.classIds : []);
    const targetStudents = Array.isArray(contest.targetStudents) 
      ? contest.targetStudents 
      : (Array.isArray(contest.candidateIds) ? contest.candidateIds : []);
    const targetGrades = Array.isArray(contest.targetGrades) 
      ? contest.targetGrades.map(Number) 
      : [];

    let scopeType = contest.scopeType || 'ALL';
    if (!contest.scopeType) {
      if (targetStudents.length > 0) scopeType = 'STUDENT';
      else if (targetGrades.length > 0) scopeType = 'GRADE';
      else if (targetClasses.length > 0) scopeType = 'CLASS';
      else scopeType = 'ALL';
    }

    const newContest = {
      id: newId('cnt'),
      title: String(contest.title || "").trim(),
      description: String(contest.description || ""),
      mode: contest.mode || "offline", // "offline" = Mạng LAN phòng máy; "online" = Trực tuyến qua Internet
      scopeType,
      targetGrades,
      targetClasses,
      targetStudents,
      totalScore: Number(contest.totalScore) || 100, // Tổng điểm toàn kỳ thi (mặc định 100)
      memoryLimit: Math.min(272, Math.max(240, Number(contest.memoryLimit) || 256)), // RAM 240-272 MB, mặc định 256 MB
      category: contest.category || "regular",
      classIds: Array.isArray(contest.classIds) ? contest.classIds : (targetClasses || []), // Array of class IDs allowed to take contest ([] = all)
      candidateIds: Array.isArray(contest.candidateIds) ? contest.candidateIds : (targetStudents || []),
      problemIds: Array.isArray(contest.problemIds) ? contest.problemIds : [], // Array of problem IDs in contest
      pdfUrl: contest.pdfUrl || "",
      pdfFileName: contest.pdfFileName || "",
      statementHtml: contest.statementHtml || "",
      _pdfDiskPath: contest._pdfDiskPath || "",
      startTime: contest.startTime || new Date().toISOString(),
      endTime: contest.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      durationMinutes: Number(contest.durationMinutes) || 45,
      status: contest.status || "running", // "upcoming" | "running" | "ended"
      gradingMode: contest.gradingMode || "direct", // "direct" | "batch_after_deadline"
      freezeScoreboardMinutes: Number(contest.freezeScoreboardMinutes) || 15,
      pinCode: contest.pinCode ? String(contest.pinCode).trim() : "",
      hideTestDetailsForStudents: contest.hideTestDetailsForStudents !== false,
      requireFreopen: !!contest.requireFreopen,
      allowReopen: contest.allowReopen !== false,
      ioMode: contest.ioMode || (contest.requireFreopen ? 'freopen' : 'stdin'),
      ipWhitelist: String(contest.ipWhitelist || '').trim(),
      antiCheat: {
        preventTabSwitch: contest.antiCheat?.preventTabSwitch !== false,
        maxTabViolations: Number(contest.antiCheat?.maxTabViolations) || 3,
        preventCopyPaste: !!contest.antiCheat?.preventCopyPaste
      },
      createdAt: new Date().toISOString()
    };
    this.data.contests.unshift(newContest);
    this.flushSync();
    return newContest;
  }

  updateContest(id, updates) {
    if (!this.data.contests) this.data.contests = [];
    const idx = this.data.contests.findIndex(c => c.id === id);
    if (idx !== -1) {
      const merged = { ...this.data.contests[idx], ...updates };
      if (updates.targetClasses !== undefined) {
        merged.classIds = updates.targetClasses;
      } else if (updates.classIds !== undefined && updates.targetClasses === undefined) {
        merged.targetClasses = updates.classIds;
      }
      if (updates.targetStudents !== undefined) {
        merged.candidateIds = updates.targetStudents;
      } else if (updates.candidateIds !== undefined && updates.targetStudents === undefined) {
        merged.targetStudents = updates.candidateIds;
      }
      if (updates.targetGrades !== undefined) {
        merged.targetGrades = Array.isArray(updates.targetGrades) ? updates.targetGrades.map(Number) : [];
      }
      if (updates.totalScore !== undefined) {
        merged.totalScore = Number(updates.totalScore);
      }
      if (updates.memoryLimit !== undefined) {
        merged.memoryLimit = Math.min(272, Math.max(240, Number(updates.memoryLimit) || 256));
      }
      if (updates.category !== undefined) {
        merged.category = updates.category;
      }
      if (updates.allowReopen !== undefined) {
        merged.allowReopen = updates.allowReopen !== false;
      }
      if (updates.ioMode !== undefined) {
        merged.ioMode = updates.ioMode;
      }
      this.data.contests[idx] = merged;
      this.flushSync();
      return this.data.contests[idx];
    }
    return null;
  }

  isStudentEligible(student, contest) {
    if (!student || !contest) return false;
    if (student.role === 'host') return true;

    const scopeType = (contest.scopeType || '').toUpperCase();
    const studentClasses = Array.isArray(student.classes) && student.classes.length > 0
      ? student.classes
      : (student.classId ? [student.classId] : []);

    if (!scopeType || scopeType === 'ALL') {
      if (Array.isArray(contest.candidateIds) && contest.candidateIds.length > 0) {
        return contest.candidateIds.includes(student.id);
      }
      if (Array.isArray(contest.classIds) && contest.classIds.length > 0) {
        return studentClasses.some(cId => contest.classIds.includes(cId));
      }
      return true;
    }

    if (scopeType === 'GRADE') {
      const targetGrades = Array.isArray(contest.targetGrades)
        ? contest.targetGrades.map(Number)
        : (contest.targetGrade ? [Number(contest.targetGrade)] : []);
      if (targetGrades.length === 0) return true;

      const allClasses = this.getClasses() || [];
      return studentClasses.some(cId => {
        const cls = allClasses.find(c => c.id === cId || c.name === cId);
        const grade = cls && cls.grade !== undefined && cls.grade !== null 
          ? Number(cls.grade) 
          : parseInt(String(cls ? cls.name : cId).match(/\d+/)?.[0] || '0', 10);
        return targetGrades.includes(grade);
      });
    }

    if (scopeType === 'CLASS') {
      const targetClasses = (Array.isArray(contest.targetClasses) && contest.targetClasses.length > 0)
        ? contest.targetClasses
        : (contest.classIds || []);
      if (targetClasses.length === 0) return true;
      return studentClasses.some(cId => targetClasses.includes(cId));
    }

    if (scopeType === 'STUDENT') {
      const targetStudents = (Array.isArray(contest.targetStudents) && contest.targetStudents.length > 0)
        ? contest.targetStudents
        : (contest.candidateIds || []);
      return targetStudents.includes(student.id);
    }

    return true;
  }

  deleteContest(id) {
    if (!this.data.contests) return false;
    const initialLen = this.data.contests.length;
    this.data.contests = this.data.contests.filter(c => c.id !== id);
    if (this.data.contests.length !== initialLen) {
      this.flushSync();
      return true;
    }
    return false;
  }

  getContestLeaderboard(contestId, isVirtual = false, options = {}) {
    const contest = this.getContest(contestId);
    if (!contest) return [];

    const allowedClasses = new Set(contest.classIds || []);
    
    // Filter users allowed for this contest
    let eligibleUsers = this.data.users.filter(u => u.role === 'user');
    if (allowedClasses.size > 0 && !isVirtual) {
      eligibleUsers = eligibleUsers.filter(u => allowedClasses.has(u.classId));
    }

    const userMap = {};
    for (const u of eligibleUsers) {
      userMap[u.id] = {
        userId: u.id,
        userName: u.fullName,
        username: u.username,
        classId: u.classId,
        totalScore: 0,
        problemsSolved: 0,
        totalSubmissions: 0,
        solvedProblems: {},
        badges: u.badges || []
      };
    }

    // Submissions for this contest: strictly separate official vs virtual!
    const contestSubs = this.data.submissions.filter(s => {
      const matchContest = s.contestId === contestId;
      if (!matchContest) return false;
      if (isVirtual ? !s.isVirtual : !!s.isVirtual) return false;
      if (options.submittedBefore) {
        const submittedAt = new Date(s.submittedAt).getTime();
        if (!Number.isFinite(submittedAt) || submittedAt > options.submittedBefore) return false;
      }
      return true;
    });

    for (const sub of contestSubs) {
      if (!userMap[sub.userId]) {
        if (isVirtual) {
          // Add user to virtual map if not initially in userMap
          userMap[sub.userId] = {
            userId: sub.userId,
            userName: sub.userName,
            username: sub.userName,
            classId: '',
            totalScore: 0,
            problemsSolved: 0,
            totalSubmissions: 0,
            solvedProblems: {},
            badges: []
          };
        } else {
          continue;
        }
      }
      userMap[sub.userId].totalSubmissions++;
      const currentScore = userMap[sub.userId].solvedProblems[sub.problemId]?.score || 0;
      if (sub.score >= currentScore) {
        userMap[sub.userId].solvedProblems[sub.problemId] = {
          score: sub.score,
          status: sub.status,
          time: sub.executionTime
        };
      }
    }

    const leaderboard = Object.values(userMap).map(u => {
      let total = 0;
      let solved = 0;
      for (const pId in u.solvedProblems) {
        total += u.solvedProblems[pId].score;
        if (u.solvedProblems[pId].status === 'AC') solved++;
      }
      return {
        ...u,
        totalScore: total,
        problemsSolved: solved
      };
    });

    // If virtual leaderboard, only return users who made at least 1 virtual submission
    const result = isVirtual 
      ? leaderboard.filter(u => u.totalSubmissions > 0)
      : leaderboard;

    return result.sort((a, b) => b.totalScore - a.totalScore || b.problemsSolved - a.problemsSolved);
  }

  // Virtual Session Management
  createVirtualSession({ userId, userName, contestId, durationMinutes }) {
    if (!this.data.virtual_sessions) this.data.virtual_sessions = [];
    const contest = this.getContest(contestId);
    const duration = durationMinutes || (contest ? contest.durationMinutes : 90);
    const now = Date.now();
    const session = {
      id: newId('vs'),
      userId,
      userName,
      contestId,
      contestTitle: contest ? contest.title : 'Kỳ thi',
      startTime: new Date(now).toISOString(),
      endTime: new Date(now + duration * 60 * 1000).toISOString(),
      durationMinutes: duration,
      status: 'running',
      allowReopen: contest ? contest.allowReopen !== false : true,
      score: 0,
      problemsSolved: 0,
      totalSubmissions: 0,
      lastActiveAt: new Date(now).toISOString(),
      createdAt: new Date().toISOString()
    };
    this.data.virtual_sessions.push(session);
    this.save();
    return session;
  }

  getVirtualSessions({ userId, contestId } = {}) {
    if (!this.data.virtual_sessions) this.data.virtual_sessions = [];
    return this.data.virtual_sessions.filter(vs => {
      if (userId && vs.userId !== userId) return false;
      if (contestId && vs.contestId !== contestId) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getVirtualSession(id) {
    if (!this.data.virtual_sessions) this.data.virtual_sessions = [];
    return this.data.virtual_sessions.find(vs => vs.id === id);
  }

  leaveVirtualSession(id) {
    const session = this.getVirtualSession(id);
    if (!session) return null;
    if (session.status === 'running') {
      session.status = 'left';
    }
    session.lastActiveAt = new Date().toISOString();
    this.save();
    return session;
  }

  resumeVirtualSession(id) {
    const session = this.getVirtualSession(id);
    if (!session) return null;
    if (session.status === 'left') {
      session.status = 'running';
    }
    session.lastActiveAt = new Date().toISOString();
    this.save();
    return session;
  }

  getActiveVirtualSession(userId) {
    if (!this.data.virtual_sessions) this.data.virtual_sessions = [];
    const now = Date.now();
    const session = this.data.virtual_sessions.find(vs => 
      vs.userId === userId && (vs.status === 'running' || vs.status === 'left')
    );
    if (!session) return null;
    const end = new Date(session.endTime).getTime();
    if (now > end) {
      return this.finishVirtualSession(session.id, 'timeout');
    }
    return session;
  }

  finishVirtualSession(id, endReason = 'manual') {
    const session = this.getVirtualSession(id);
    if (!session) return null;
    session.status = endReason === 'timeout' ? 'timeout' : 'completed';
    session.endReason = endReason;
    session.endedAt = new Date().toISOString();
    session.lastActiveAt = session.endedAt;
    const sessionSubs = this.data.submissions.filter(s => s.virtualSessionId === id);
    const probMap = {};
    for (const sub of sessionSubs) {
      if (!probMap[sub.problemId] || sub.score > probMap[sub.problemId].score) {
        probMap[sub.problemId] = sub;
      }
    }
    let totalScore = 0;
    let solved = 0;
    for (const pId in probMap) {
      totalScore += probMap[pId].score || 0;
      if (probMap[pId].status === 'AC') solved++;
    }
    session.score = totalScore;
    session.problemsSolved = solved;
    session.totalSubmissions = sessionSubs.length;
    this.save();
    return session;
  }

  // Student Exam History & Portfolio
  getUserExamHistory(userId) {
    const history = [];
    const contests = this.data.contests || [];
    for (const contest of contests) {
      const attendance = (this.data.contest_attendance?.[contest.id]?.[userId]) || null;
      const isCandidate = (contest.candidateIds && contest.candidateIds.includes(userId)) ||
        (!contest.candidateIds || contest.candidateIds.length === 0);
      const userSubs = (this.data.submissions || []).filter(s => s.contestId === contest.id && s.userId === userId && !s.isVirtual);
      
      if (attendance || userSubs.length > 0 || isCandidate) {
        const lb = this.getContestLeaderboard(contest.id);
        const myEntry = lb.find(e => e.userId === userId);
        const myRank = myEntry ? lb.findIndex(e => e.userId === userId) + 1 : 0;
        
        history.push({
          contestId: contest.id,
          contestTitle: contest.title,
          date: contest.startTime,
          score: myEntry ? myEntry.totalScore : 0,
          rank: myRank,
          totalParticipants: lb.length,
          problemsSolved: myEntry ? myEntry.problemsSolved : 0,
          totalProblems: contest.problemIds?.length || 0,
          status: attendance?.status || (userSubs.length > 0 ? 'present' : 'absent_unexcused'),
          extraMinutes: attendance?.extraMinutes || 0,
          reason: attendance?.reason || ''
        });
      }
    }
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Contest Attendance & Candidate Whitelist
  getContestAttendanceRecord(contestId, userId) {
    const record = this.data.contest_attendance?.[contestId]?.[userId];
    if (!record) return null;
    return {
      status: record.status || 'present',
      extraMinutes: Number(record.extraMinutes) || 0,
      reason: record.reason || '',
      reopened: !!record.reopened,
      ...(record.ip ? { ip: record.ip } : {}),
      ...(record.lastActive ? { lastActive: record.lastActive } : {})
    };
  }

  getContestAttendance(contestId) {
    const contest = this.getContest(contestId);
    if (!contest) return [];
    if (!this.data.contest_attendance) this.data.contest_attendance = {};
    if (!this.data.contest_attendance[contestId]) this.data.contest_attendance[contestId] = {};
    const attMap = this.data.contest_attendance[contestId];

    const allStudents = this.data.users.filter(u => u.role !== 'host');
    let candidateUsers = [];
    if (contest.candidateIds && contest.candidateIds.length > 0) {
      candidateUsers = allStudents.filter(u => contest.candidateIds.includes(u.id));
    } else if (contest.classIds && contest.classIds.length > 0) {
      candidateUsers = allStudents.filter(u => contest.classIds.includes(u.classId));
    } else {
      candidateUsers = allStudents;
    }

    const contestSubs = (this.data.submissions || []).filter(s => s.contestId === contestId && !s.isVirtual);

    const result = candidateUsers.map(u => {
      const record = attMap[u.id] || { status: 'absent_unexcused', extraMinutes: 0, reason: '' };
      const mySubs = contestSubs.filter(s => s.userId === u.id);
      
      const probBest = {};
      for (const s of mySubs) {
        if (!probBest[s.problemId] || s.score > probBest[s.problemId]) {
          probBest[s.problemId] = s.score;
        }
      }
      const currentScore = Object.values(probBest).reduce((a, b) => a + b, 0);

      let currentStatus = record.status;
      if (mySubs.length > 0 && currentStatus === 'absent_unexcused') {
        currentStatus = 'present';
      }

      return {
        userId: u.id,
        username: u.username,
        fullName: u.fullName,
        classId: u.classId,
        isLocked: !!u.isLocked,
        status: currentStatus,
        extraMinutes: record.extraMinutes || 0,
        reason: record.reason || '',
        ip: record.ip || '',
        lastActive: record.lastActive || (mySubs.length > 0 ? mySubs[mySubs.length - 1].submittedAt : null),
        submissionsCount: mySubs.length,
        currentScore
      };
    });

    return result;
  }

  updateContestAttendance(contestId, userId, data = {}) {
    if (!this.data.contest_attendance) this.data.contest_attendance = {};
    if (!this.data.contest_attendance[contestId]) this.data.contest_attendance[contestId] = {};
    
    const existing = this.data.contest_attendance[contestId][userId] || { status: 'present', extraMinutes: 0, reason: '', reopened: false };
    if (data.status) existing.status = data.status;
    if (data.reason !== undefined) existing.reason = data.reason;
    if (data.extraMinutes !== undefined) existing.extraMinutes = Number(data.extraMinutes) || 0;
    if (data.ip) existing.ip = data.ip;
    if (data.lastActive) existing.lastActive = data.lastActive;
    if (data.reopened !== undefined) existing.reopened = !!data.reopened;

    this.data.contest_attendance[contestId][userId] = existing;
    this.save();
    return existing;
  }

  addExtraTime(contestId, userId, extraMinutes = 5) {
    if (!this.data.contest_attendance) this.data.contest_attendance = {};
    if (!this.data.contest_attendance[contestId]) this.data.contest_attendance[contestId] = {};
    
    const existing = this.data.contest_attendance[contestId][userId] || { status: 'present', extraMinutes: 0, reason: '', reopened: false };
    existing.extraMinutes = (existing.extraMinutes || 0) + Number(extraMinutes);
    this.data.contest_attendance[contestId][userId] = existing;
    this.save();
    return existing;
  }

  reopenContestForUser(contestId, userId) {
    if (!this.data.contest_attendance) this.data.contest_attendance = {};
    if (!this.data.contest_attendance[contestId]) this.data.contest_attendance[contestId] = {};
    
    const existing = this.data.contest_attendance[contestId][userId] || { status: 'present', extraMinutes: 0, reason: '', reopened: false };
    existing.status = 'present';
    existing.reopened = true;
    this.data.contest_attendance[contestId][userId] = existing;

    const vs = (this.data.virtual_sessions || []).find(v => v.contestId === contestId && v.userId === userId && v.status === 'completed');
    if (vs) {
      vs.status = 'running';
    }

    this.save();
    return existing;
  }

  updateContestCandidates(contestId, candidateIds = []) {
    const contest = this.getContest(contestId);
    if (!contest) return null;
    contest.candidateIds = candidateIds;
    this.save();
    return contest;
  }

  // Official Report: Strictly participationType === 'REAL' (excludes virtual!)
  getOfficialContestReport(contestId) {
    const contest = this.getContest(contestId);
    if (!contest) return null;

    const classMap = {};
    (this.data.classes || []).forEach(c => { classMap[c.id] = c.name; });

    // Official Leaderboard (isVirtual = false)
    const officialLeaderboard = this.getContestLeaderboard(contestId, false);

    // Filter to only candidates who actually participated or submitted official code
    // Sort by Total Score DESC, then solved problems DESC, then student name ASC
    const participants = officialLeaderboard
      .filter(u => u.totalSubmissions > 0 || u.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore || b.problemsSolved - a.problemsSolved || a.userName.localeCompare(b.userName));

    // Map to simple 4-column structure: STT, HỌ VÀ TÊN, LỚP, ĐIỂM
    const rows = participants.map((item, idx) => ({
      stt: idx + 1,
      fullName: item.userName,
      className: classMap[item.classId] || item.classId || 'Tự do',
      score: item.totalScore,
      problemsSolved: item.problemsSolved,
      totalSubmissions: item.totalSubmissions,
      participationType: 'REAL'
    }));

    return {
      contestId: contest.id,
      contestTitle: contest.title,
      startTime: contest.startTime,
      endTime: contest.endTime,
      totalScore: contest.totalScore || 100,
      participantCount: rows.length,
      rows
    };
  }

  // ==================== ACHIEVEMENTS ====================
  getAchievements() {
    return this.data.achievements || [];
  }

  getAchievement(id) {
    return (this.data.achievements || []).find(a => a.id === id);
  }

  createAchievement(data) {
    const ach = {
      id: data.id || ('ach_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      code: data.code || ('ACH_' + Date.now()),
      name: data.name || 'Thành tựu mới',
      description: data.description || '',
      icon: data.icon || '🏆',
      category: data.category || 'SPECIAL',
      conditionType: data.conditionType || 'MANUAL',
      conditionValue: Number(data.conditionValue) || 1,
      points: Number(data.points) || 10,
      rarity: data.rarity || 'COMMON',
      isActive: data.isActive !== undefined ? !!data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.achievements = this.data.achievements || [];
    this.data.achievements.push(ach);
    this.save();
    return ach;
  }

  updateAchievement(id, updates) {
    const ach = this.getAchievement(id);
    if (!ach) return null;
    Object.assign(ach, updates, { updatedAt: new Date().toISOString() });
    if (updates.points !== undefined) ach.points = Number(updates.points);
    if (updates.conditionValue !== undefined) ach.conditionValue = Number(updates.conditionValue);
    this.save();
    return ach;
  }

  deleteAchievement(id) {
    const idx = (this.data.achievements || []).findIndex(a => a.id === id);
    if (idx === -1) return false;
    this.data.achievements.splice(idx, 1);
    this.save();
    return true;
  }

  getStudentAchievements(studentId) {
    return (this.data.student_achievements || []).filter(sa => sa.studentId === studentId);
  }

  awardAchievement(studentId, achievementId) {
    const existing = (this.data.student_achievements || []).find(
      sa => sa.studentId === studentId && sa.achievementId === achievementId
    );
    if (existing) return existing;

    const ach = this.getAchievement(achievementId);
    if (!ach || !ach.isActive) return null;

    const award = {
      id: 'sa_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      studentId,
      achievementId,
      awardedAt: new Date().toISOString()
    };
    this.data.student_achievements = this.data.student_achievements || [];
    this.data.student_achievements.push(award);

    // Add points to user profile
    const user = this.getUser(studentId);
    if (user) {
      user.points = (user.points || 0) + (ach.points || 0);
    }
    this.save();
    return award;
  }

  checkAndAwardAchievements(studentId) {
    if (!studentId) return [];
    const user = this.getUser(studentId);
    if (!user) return [];

    const existingAwards = new Set(
      (this.data.student_achievements || [])
        .filter(sa => sa.studentId === studentId)
        .map(sa => sa.achievementId)
    );

    const submissions = this.getSubmissions({ userId: studentId });
    const acSubmissions = submissions.filter(s => s.status === 'Accepted');
    const solvedProblemIds = new Set(acSubmissions.map(s => s.problemId));
    const contestIds = new Set(submissions.filter(s => s.contestId).map(s => s.contestId));

    const newlyAwarded = [];
    const allAchievements = this.getAchievements();

    for (const ach of allAchievements) {
      if (!ach.isActive) continue;
      if (existingAwards.has(ach.id)) continue;

      let eligible = false;
      const targetVal = ach.conditionValue || 1;

      switch (ach.conditionType) {
        case 'FIRST_SUBMISSION':
          eligible = submissions.length >= 1;
          break;
        case 'FIRST_AC':
          eligible = acSubmissions.length >= 1;
          break;
        case 'AC_COUNT':
          eligible = acSubmissions.length >= targetVal;
          break;
        case 'SUBMISSION_COUNT':
          eligible = submissions.length >= targetVal;
          break;
        case 'SOLVE_COUNT':
          eligible = solvedProblemIds.size >= targetVal;
          break;
        case 'CONTEST_COUNT':
          eligible = contestIds.size >= targetVal;
          break;
        case 'POINTS':
          eligible = (user.points || 0) >= targetVal;
          break;
        default:
          break;
      }

      if (eligible) {
        const award = this.awardAchievement(studentId, ach.id);
        if (award) {
          existingAwards.add(ach.id);
          newlyAwarded.push({ ...award, achievement: ach });
        }
      }
    }

    return newlyAwarded;
  }

  // ==================== REWARDS ====================
  getRewards() {
    return this.data.rewards || [];
  }

  getReward(id) {
    return (this.data.rewards || []).find(r => r.id === id);
  }

  createReward(data) {
    const reward = {
      id: data.id || ('rew_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      name: data.name || 'Phần thưởng mới',
      description: data.description || '',
      icon: data.icon || '🎁',
      image: data.image || '',
      pointsRequired: Number(data.pointsRequired) || 50,
      stock: Number(data.stock) !== undefined ? Number(data.stock) : 10,
      isActive: data.isActive !== undefined ? !!data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.rewards = this.data.rewards || [];
    this.data.rewards.push(reward);
    this.save();
    return reward;
  }

  updateReward(id, updates) {
    const reward = this.getReward(id);
    if (!reward) return null;
    Object.assign(reward, updates, { updatedAt: new Date().toISOString() });
    if (updates.pointsRequired !== undefined) reward.pointsRequired = Number(updates.pointsRequired);
    if (updates.stock !== undefined) reward.stock = Math.max(0, Number(updates.stock));
    this.save();
    return reward;
  }

  deleteReward(id) {
    const idx = (this.data.rewards || []).findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.data.rewards.splice(idx, 1);
    this.save();
    return true;
  }

  redeemReward(studentId, rewardId) {
    const reward = this.getReward(rewardId);
    if (!reward || !reward.isActive) {
      throw new Error('Phần thưởng không tồn tại hoặc đã tạm dừng đổi');
    }
    if (reward.stock <= 0) {
      throw new Error('Phần thưởng đã hết hàng trong kho');
    }
    const user = this.getUser(studentId);
    if (!user) {
      throw new Error('Không tìm thấy tài khoản người dùng');
    }
    const currentPoints = user.points || 0;
    if (currentPoints < reward.pointsRequired) {
      throw new Error(`Bạn cần ${reward.pointsRequired} điểm để đổi, hiện chỉ có ${currentPoints} điểm`);
    }

    // Deduct stock and points safely
    reward.stock -= 1;
    user.points = currentPoints - reward.pointsRequired;

    const redemption = {
      id: 'red_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      studentId,
      studentName: user.name || user.username,
      rewardId: reward.id,
      rewardName: reward.name,
      rewardIcon: reward.icon || '🎁',
      pointsSpent: reward.pointsRequired,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };

    this.data.reward_redemptions = this.data.reward_redemptions || [];
    this.data.reward_redemptions.unshift(redemption);
    this.save();
    return redemption;
  }

  getRewardRedemptions(studentId = null) {
    const list = this.data.reward_redemptions || [];
    if (studentId) {
      return list.filter(r => r.studentId === studentId);
    }
    return list;
  }

  updateRedemptionStatus(redemptionId, status) {
    const red = (this.data.reward_redemptions || []).find(r => r.id === redemptionId);
    if (!red) return null;
    const oldStatus = red.status;
    red.status = status;
    red.processedAt = new Date().toISOString();

    // If rejected, refund points & stock
    if (status === 'REJECTED' && oldStatus !== 'REJECTED') {
      const user = this.getUser(red.studentId);
      if (user) {
        user.points = (user.points || 0) + (red.pointsSpent || 0);
      }
      const reward = this.getReward(red.rewardId);
      if (reward) {
        reward.stock += 1;
      }
    }
    this.save();
    return red;
  }
}

module.exports = new Database();
