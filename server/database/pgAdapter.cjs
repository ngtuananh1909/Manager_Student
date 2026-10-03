'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('./pool.cjs');
const usersRepo = require('./repos/users.cjs');
const classesRepo = require('./repos/classes.cjs');
const problemsRepo = require('./repos/problems.cjs');
const contestsRepo = require('./repos/contests.cjs');
const submissionsRepo = require('./repos/submissions.cjs');
const leaderboardRepo = require('./repos/leaderboard.cjs');
const settingsRepo = require('./repos/settings.cjs');
const achievementsRepo = require('./repos/achievements.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

class PgAdapter {
  constructor() {
    this.DATA_DIR = process.cwd();
    this.STORAGE_DIR = path.join(process.cwd(), 'storage');
    this.cache = {
      settings: { ...settingsRepo.DEFAULT_SETTINGS },
      classes: [],
      users: [],
      problems: [],
      submissions: [],
      contests: [],
      virtual_sessions: [],
      contest_attendance: {},
      achievements: [],
      rewards: []
    };
    this.isReady = false;
    this._syncPromise = this.initCache();
  }

  async initCache() {
    try {
      const isConnected = await pool.testConnection();
      if (!isConnected.ok) {
        console.warn('[PgAdapter] Không thể kết nối tới PostgreSQL, sử dụng cache rỗng ban đầu:', isConnected.error);
        return;
      }

      // Nạp dữ liệu song song từ PostgreSQL vào cache
      const [settings, classes, users, problems, contests, submissions, achievements, rewards] = await Promise.all([
        settingsRepo.getSettings().catch(() => settingsRepo.DEFAULT_SETTINGS),
        classesRepo.getClasses().catch(() => []),
        usersRepo.getUsers().catch(() => []),
        problemsRepo.getProblems({ includeTestCases: false }).catch(() => []),
        contestsRepo.getContests().catch(() => []),
        submissionsRepo.getSubmissions({}).catch(() => []),
        achievementsRepo.getAchievements().catch(() => []),
        achievementsRepo.getRewards().catch(() => [])
      ]);

      this.cache.settings = settings;
      this.cache.classes = classes;
      this.cache.users = users;
      this.cache.problems = problems;
      this.cache.contests = contests;
      this.cache.submissions = submissions;
      this.cache.achievements = achievements;
      this.cache.rewards = rewards;
      this.isReady = true;

      console.log('⚡ [PgAdapter] Đã đồng bộ cache từ PostgreSQL vào bộ nhớ thành công.');
    } catch (err) {
      console.error('[PgAdapter] Lỗi khởi tạo cache từ PostgreSQL:', err);
    }
  }

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------
  getSettings() {
    return this.cache.settings;
  }

  updateSettings(newSettings = {}) {
    this.cache.settings = { ...this.cache.settings, ...newSettings };
    settingsRepo.updateSettings(newSettings).catch(err => {
      console.error('[PgAdapter] Lỗi ghi settings vào PG:', err);
    });
    return this.cache.settings;
  }

  // --------------------------------------------------------------------------
  // First Run Check & Admin Setup
  // --------------------------------------------------------------------------
  isFirstRun() {
    return !this.cache.users.some(u => u.role === 'host' || u.role === 'admin');
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
      classes: ['admin-class'],
      createdAt: new Date().toISOString()
    };

    const defaultClass = {
      id: newId('cls'),
      name: adminData.className || "Lớp Tin Học 1",
      teacher: admin.fullName,
      joinCode: "TIN01"
    };

    if (adminData.serverName) {
      this.cache.settings.serverName = adminData.serverName.trim();
    }

    this.cache.users = [admin];
    this.cache.classes = [defaultClass];

    // Ghi vào PostgreSQL ngầm
    usersRepo.setupFirstAdmin(adminData).catch(err => {
      console.error('[PgAdapter] Lỗi ghi setupFirstAdmin vào PG:', err);
    });

    return { admin, defaultClass };
  }

  // --------------------------------------------------------------------------
  // Problems
  // --------------------------------------------------------------------------
  getProblems(options = {}) {
    return this.cache.problems.map(p => ({
      ...p,
      testCases: []
    }));
  }

  getProblem(idOrCode, options = {}) {
    if (!idOrCode) return null;
    const clean = String(idOrCode).trim().toUpperCase();
    const prob = this.cache.problems.find(p => p.id === idOrCode || String(p.code).toUpperCase() === clean);
    if (!prob) return null;

    if (options.includeTestCases !== false) {
      // Đọc testcases từ file đĩa
      const tcs = this.getProblemTestCases(prob.id);
      return { ...prob, testCases: tcs };
    }
    return { ...prob, testCases: [] };
  }

  getProblemTestCases(problemId) {
    if (!problemId) return [];
    const probDir = path.join(this.STORAGE_DIR, 'testcases', problemId);
    if (!fs.existsSync(probDir)) return [];

    try {
      const files = fs.readdirSync(probDir);
      const inpFiles = files.filter(f => f.toLowerCase().endsWith('.inp')).sort();
      return inpFiles.map((inpF, idx) => {
        const baseName = inpF.replace(/\.inp$/i, '');
        const outF = files.find(f => f.toLowerCase() === `${baseName.toLowerCase()}.out`);
        const inContent = fs.readFileSync(path.join(probDir, inpF), 'utf8');
        const outContent = outF ? fs.readFileSync(path.join(probDir, outF), 'utf8') : '';
        return {
          id: `${problemId}-tc-${idx + 1}`,
          name: baseName,
          score: 10,
          isSample: idx === 0,
          input: inContent,
          expectedOutput: outContent
        };
      });
    } catch (e) {
      return [];
    }
  }

  setProblemTestCases(problemId, testCases = []) {
    problemsRepo.setProblemTestCases(problemId, testCases).catch(err => {
      console.error('[PgAdapter] Lỗi ghi testcases vào PG/disk:', err);
    });
    const prob = this.cache.problems.find(p => p.id === problemId);
    if (prob) {
      prob.testCount = Array.isArray(testCases) ? testCases.length : 0;
    }
  }

  createProblem(probData) {
    const id = probData.id || newId('prob');
    const newProb = {
      id,
      code: String(probData.code || 'BAI').toUpperCase().trim(),
      title: String(probData.title || probData.code || 'Bài tập').trim(),
      difficulty: probData.difficulty || "Trung bình",
      points: Number(probData.points) || 100,
      timeLimit: Number(probData.timeLimit) || 1000,
      memoryLimit: Number(probData.memoryLimit) || (this.cache.settings.globalMemoryLimit || 256),
      category: probData.category || "C++11",
      description: probData.description || "",
      statement: probData.statement || "",
      statementHtml: probData.statementHtml || "",
      samples: Array.isArray(probData.samples) ? probData.samples : [],
      sampleCode: probData.sampleCode || `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Code C++\n    return 0;\n}\n`,
      pdfUrl: probData.pdfUrl || "",
      pdfFileName: probData.pdfFileName || "",
      testCount: Array.isArray(probData.testCases) ? probData.testCases.length : 0
    };

    this.cache.problems.unshift(newProb);
    if (Array.isArray(probData.testCases)) {
      this.setProblemTestCases(id, probData.testCases);
    }

    problemsRepo.createProblem({ ...newProb, testCases: probData.testCases }).catch(err => {
      console.error('[PgAdapter] Lỗi ghi bài tập vào PG:', err);
    });

    return { ...newProb, testCases: probData.testCases || [] };
  }

  updateProblem(id, updates = {}) {
    const idx = this.cache.problems.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const merged = { ...this.cache.problems[idx], ...updates };
    this.cache.problems[idx] = merged;

    if (Array.isArray(updates.testCases)) {
      this.setProblemTestCases(id, updates.testCases);
      merged.testCount = updates.testCases.length;
    }

    problemsRepo.updateProblem(id, updates).catch(err => {
      console.error('[PgAdapter] Lỗi cập nhật bài tập vào PG:', err);
    });

    return merged;
  }

  deleteProblem(id) {
    const initialLen = this.cache.problems.length;
    this.cache.problems = this.cache.problems.filter(p => p.id !== id);
    problemsRepo.deleteProblem(id).catch(err => {
      console.error('[PgAdapter] Lỗi xóa bài tập trong PG:', err);
    });
    return this.cache.problems.length !== initialLen;
  }

  // --------------------------------------------------------------------------
  // Users & Auth
  // --------------------------------------------------------------------------
  getUsers() {
    return this.cache.users;
  }

  getUser(idOrUsername) {
    if (!idOrUsername) return null;
    const clean = String(idOrUsername).trim().toLowerCase();
    return this.cache.users.find(u => u.id === idOrUsername || u.username.toLowerCase() === clean) || null;
  }

  createUser(user) {
    if (!user.passwordHash) {
      const error = new Error('A pre-hashed password is required');
      error.code = 'PASSWORD_HASH_REQUIRED';
      throw error;
    }
    const id = user.id || newId('usr');
    const classes = Array.isArray(user.classes) && user.classes.length > 0
      ? user.classes
      : (user.classId ? [user.classId] : [this.cache.classes[0]?.id || "cls-1"]);

    const newUser = {
      id,
      username: user.username.trim().toLowerCase(),
      passwordHash: user.passwordHash,
      fullName: user.fullName || user.username,
      role: user.role || "user",
      classId: classes[0] || (this.cache.classes[0]?.id || "cls-1"),
      classes,
      streak: 1,
      badges: [],
      isLocked: false,
      mustChangePassword: !!user.mustChangePassword,
      createdAt: new Date().toISOString()
    };

    this.cache.users.push(newUser);
    usersRepo.createUser(newUser).catch(err => {
      console.error('[PgAdapter] Lỗi thêm user vào PG:', err);
    });
    return newUser;
  }

  updateUser(id, updates = {}) {
    const user = this.getUser(id);
    if (!user) return null;

    if (updates.fullName) user.fullName = updates.fullName.trim();
    if (updates.classId) user.classId = updates.classId;
    if (updates.classes && Array.isArray(updates.classes)) {
      user.classes = updates.classes;
      if (!user.classId && updates.classes.length > 0) user.classId = updates.classes[0];
    }
    if (updates.isLocked !== undefined) user.isLocked = !!updates.isLocked;

    usersRepo.updateUser(user.id, updates).catch(err => {
      console.error('[PgAdapter] Lỗi cập nhật user vào PG:', err);
    });
    return user;
  }

  setUserPasswordHash(id, passwordHash, mustChangePassword = false) {
    const user = this.getUser(id);
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.mustChangePassword = !!mustChangePassword;

    usersRepo.setUserPasswordHash(user.id, passwordHash, mustChangePassword).catch(err => {
      console.error('[PgAdapter] Lỗi đổi mật khẩu trong PG:', err);
    });
    return user;
  }

  toggleUserLock(id) {
    const user = this.getUser(id);
    if (!user) return null;
    user.isLocked = !user.isLocked;

    usersRepo.toggleUserLock(user.id).catch(err => {
      console.error('[PgAdapter] Lỗi khóa user trong PG:', err);
    });
    return user;
  }

  deleteUser(id) {
    const initialLen = this.cache.users.length;
    this.cache.users = this.cache.users.filter(u => u.id !== id && u.username !== id);
    usersRepo.deleteUser(id).catch(err => {
      console.error('[PgAdapter] Lỗi xóa user trong PG:', err);
    });
    return this.cache.users.length !== initialLen;
  }

  authenticate(username, password) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const user = this.cache.users.find(u => u.username === cleanUser);
    if (!user) return null;

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.passwordHash && user.passwordHash !== hash) {
      return null;
    }
    return user;
  }

  // --------------------------------------------------------------------------
  // Classes
  // --------------------------------------------------------------------------
  getClasses() {
    return this.cache.classes;
  }

  createClass(cls) {
    const name = cls.name.trim();
    const autoGrade = parseInt(name.match(/\d+/)?.[0] || '0', 10) || null;
    const newClass = {
      id: cls.id || newId('cls'),
      name,
      grade: cls.grade !== undefined && cls.grade !== null && cls.grade !== '' ? Number(cls.grade) : autoGrade,
      teacher: cls.teacher || "Giáo viên",
      joinCode: (cls.joinCode || Math.random().toString(36).substring(2, 8)).toUpperCase()
    };
    this.cache.classes.push(newClass);

    classesRepo.createClass(newClass).catch(err => {
      console.error('[PgAdapter] Lỗi tạo lớp vào PG:', err);
    });
    return newClass;
  }

  // --------------------------------------------------------------------------
  // Contests
  // --------------------------------------------------------------------------
  getContests() {
    return this.cache.contests;
  }

  getContest(id) {
    return this.cache.contests.find(c => c.id === id) || null;
  }

  createContest(contest) {
    const id = contest.id || newId('cnt');
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
      id,
      title: String(contest.title || "").trim(),
      description: String(contest.description || ""),
      mode: contest.mode || "offline",
      scopeType,
      targetGrades,
      targetClasses,
      targetStudents,
      totalScore: Number(contest.totalScore) || 100,
      memoryLimit: Math.min(5120, Math.max(16, Number(contest.memoryLimit) || 256)),
      category: contest.category || "regular",
      classIds: targetClasses,
      candidateIds: targetStudents,
      problemIds: Array.isArray(contest.problemIds) ? contest.problemIds : [],
      pdfUrl: contest.pdfUrl || "",
      pdfFileName: contest.pdfFileName || "",
      statementHtml: contest.statementHtml || "",
      startTime: contest.startTime || new Date().toISOString(),
      endTime: contest.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      durationMinutes: Number(contest.durationMinutes) || 45,
      status: contest.status || "running",
      gradingMode: contest.gradingMode || "direct",
      freezeScoreboardMinutes: Number(contest.freezeScoreboardMinutes) || 15,
      pinCode: contest.pinCode ? String(contest.pinCode).trim() : "",
      hideTestDetailsForStudents: contest.hideTestDetailsForStudents !== false,
      requireFreopen: !!contest.requireFreopen,
      allowReopen: contest.allowReopen !== false,
      ioMode: contest.ioMode || (contest.requireFreopen ? 'freopen' : 'stdin'),
      scoringMode: ['LIVE_BEST', 'OLYMPIC_LATEST', 'PRETEST'].includes(contest.scoringMode) ? contest.scoringMode : 'LIVE_BEST',
      ipWhitelist: String(contest.ipWhitelist || '').trim(),
      antiCheat: contest.antiCheat || { preventTabSwitch: true, maxTabViolations: 3, preventCopyPaste: false },
      createdAt: new Date().toISOString()
    };

    this.cache.contests.unshift(newContest);
    contestsRepo.createContest(newContest).catch(err => {
      console.error('[PgAdapter] Lỗi ghi kỳ thi vào PG:', err);
    });
    return newContest;
  }

  updateContest(id, updates) {
    const idx = this.cache.contests.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const merged = { ...this.cache.contests[idx], ...updates };
    this.cache.contests[idx] = merged;

    contestsRepo.updateContest(id, updates).catch(err => {
      console.error('[PgAdapter] Lỗi cập nhật kỳ thi vào PG:', err);
    });
    return merged;
  }

  deleteContest(id) {
    const initialLen = this.cache.contests.length;
    this.cache.contests = this.cache.contests.filter(c => c.id !== id);
    contestsRepo.deleteContest(id).catch(err => {
      console.error('[PgAdapter] Lỗi xóa kỳ thi trong PG:', err);
    });
    return this.cache.contests.length !== initialLen;
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
      const targetGrades = Array.isArray(contest.targetGrades) ? contest.targetGrades.map(Number) : [];
      if (targetGrades.length === 0) return true;
      const allClasses = this.getClasses() || [];
      return studentClasses.some(cId => {
        const cls = allClasses.find(c => c.id === cId || c.name === cId);
        const grade = cls && cls.grade !== undefined ? Number(cls.grade) : parseInt(String(cls ? cls.name : cId).match(/\d+/)?.[0] || '0', 10);
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

  // --------------------------------------------------------------------------
  // Submissions
  // --------------------------------------------------------------------------
  getSubmissions(filter = {}) {
    let list = [...this.cache.submissions];
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
    return this.cache.submissions.find(s => s.id === id) || null;
  }

  createSubmission(sub) {
    const id = sub.id || newId('sub');
    const user = this.getUser(sub.userId);
    const prob = this.getProblem(sub.problemId, { includeTestCases: false });

    const newSub = {
      id,
      userId: sub.userId,
      userName: user ? user.fullName : sub.userId,
      problemId: sub.problemId,
      problemCode: prob ? prob.code : 'CODE',
      contestId: sub.contestId || null,
      code: sub.code || "",
      status: sub.status || 'QUEUED',
      score: Number(sub.score) || 0,
      passedTests: Number(sub.passedTests) || 0,
      totalTests: Number(sub.totalTests) || 0,
      executionTime: Number(sub.executionTime) || 0,
      memoryUsed: Number(sub.memoryUsed) || 0,
      submittedAt: new Date().toISOString(),
      compileError: null,
      isVirtual: !!sub.isVirtual,
      participationType: sub.participationType || (sub.isVirtual ? 'VIRTUAL' : 'REAL'),
      virtualSessionId: sub.virtualSessionId || null,
      details: []
    };

    this.cache.submissions.unshift(newSub);
    submissionsRepo.createSubmission(newSub).catch(err => {
      console.error('[PgAdapter] Lỗi ghi bài nộp vào PG:', err);
    });
    return newSub;
  }

  updateSubmission(id, updates) {
    const idx = this.cache.submissions.findIndex(s => s.id === id);
    if (idx === -1) return null;

    const merged = { ...this.cache.submissions[idx], ...updates };
    this.cache.submissions[idx] = merged;

    submissionsRepo.updateSubmission(id, updates).catch(err => {
      console.error('[PgAdapter] Lỗi cập nhật bài nộp trong PG:', err);
    });
    return merged;
  }

  // --------------------------------------------------------------------------
  // Leaderboards
  // --------------------------------------------------------------------------
  getLeaderboard() {
    return leaderboardRepo.getLeaderboard();
  }

  getContestLeaderboard(contestId, isVirtual = false, options = {}) {
    return leaderboardRepo.getContestLeaderboard(contestId, isVirtual, options);
  }

  // --------------------------------------------------------------------------
  // Virtual Sessions & Attendance
  // --------------------------------------------------------------------------
  getVirtualSession(id) {
    return (this.cache.virtual_sessions || []).find(s => s.id === id) || null;
  }

  createVirtualSession(sessionData) {
    const sess = {
      id: sessionData.id || newId('vsess'),
      contestId: sessionData.contestId,
      userId: sessionData.userId,
      status: 'running',
      startTime: sessionData.startTime || new Date().toISOString(),
      endTime: sessionData.endTime,
      durationMinutes: sessionData.durationMinutes || 45,
      createdAt: new Date().toISOString()
    };
    if (!this.cache.virtual_sessions) this.cache.virtual_sessions = [];
    this.cache.virtual_sessions.unshift(sess);
    return sess;
  }

  finishVirtualSession(id, endReason = 'manual') {
    const sess = this.getVirtualSession(id);
    if (sess) {
      sess.status = 'finished';
      sess.endReason = endReason;
      return sess;
    }
    return null;
  }

  leaveVirtualSession(id) {
    const sess = this.getVirtualSession(id);
    if (sess) {
      sess.status = 'paused';
      return sess;
    }
    return null;
  }

  resumeVirtualSession(id) {
    const sess = this.getVirtualSession(id);
    if (sess) {
      sess.status = 'running';
      return sess;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Achievements & Gamification
  // --------------------------------------------------------------------------
  checkAndAwardAchievements(userId) {
    return achievementsRepo.checkAndAwardAchievements(userId);
  }

  save() {
    // Không làm gì - PostgreSQL ghi tự động bằng transaction
    return true;
  }

  flushSync() {
    // Không làm gì - PostgreSQL đã có WAL & ACID
    return true;
  }
}

module.exports = new PgAdapter();
