'use strict';

const crypto = require('crypto');

function newId(prefix = 'arena') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

class ArenaManager {
  constructor() {
    this.io = null;
    this.db = null;
    this.judge = null;

    // In-memory state
    this.waitingQueue = []; // array of { socketId, userId, username, fullName, rating, joinedAt }
    this.activeMatches = new Map(); // matchId -> match object
    this.userMatchMap = new Map(); // userId -> matchId

    // Timer check interval
    this.timerInterval = null;
  }

  init(io, db, judge) {
    this.io = io;
    this.db = db;
    this.judge = judge;

    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => this.tick(), 1000);
      if (this.timerInterval.unref) this.timerInterval.unref();
    }

    io.on('connection', (socket) => {
      const user = socket.data?.user;
      if (!user) return;

      socket.on('arena:join_queue', () => {
        this.joinQueue(socket, user);
      });

      socket.on('arena:leave_queue', () => {
        this.leaveQueue(user.id);
      });

      socket.on('arena:start_bot_match', (data) => {
        this.startBotMatch(socket, user, data?.difficulty || 'medium');
      });

      socket.on('arena:submit', async (data) => {
        await this.handleSubmission(socket, user, data);
      });

      socket.on('arena:surrender', (data) => {
        this.handleSurrender(user.id, data?.matchId);
      });

      socket.on('disconnect', () => {
        this.leaveQueue(user.id);
      });
    });
  }

  getUserRating(user) {
    const fullUser = this.db.getUser(user.id);
    return fullUser?.arenaRating || 1200;
  }

  joinQueue(socket, user) {
    // If user already in active match, send reconnect info
    if (this.userMatchMap.has(user.id)) {
      const matchId = this.userMatchMap.get(user.id);
      const match = this.activeMatches.get(matchId);
      if (match && match.status === 'RUNNING') {
        socket.emit('arena:reconnect', this.sanitizeMatchForPlayer(match, user.id));
        return;
      }
    }

    // Remove if already in queue
    this.waitingQueue = this.waitingQueue.filter(p => p.userId !== user.id);

    const rating = this.getUserRating(user);
    const entry = {
      socketId: socket.id,
      userId: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      rating,
      joinedAt: Date.now()
    };

    this.waitingQueue.push(entry);
    socket.emit('arena:queue_status', { inQueue: true, position: this.waitingQueue.length });

    // Try matching
    this.checkMatchmaking();
  }

  startBotMatch(socket, user, difficulty = 'medium') {
    if (this.userMatchMap.has(user.id)) {
      const matchId = this.userMatchMap.get(user.id);
      const match = this.activeMatches.get(matchId);
      if (match && match.status === 'RUNNING') {
        socket.emit('arena:reconnect', this.sanitizeMatchForPlayer(match, user.id));
        return;
      }
    }

    this.leaveQueue(user.id);

    const userRating = this.getUserRating(user);
    const p1 = {
      socketId: socket.id,
      userId: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      rating: userRating
    };

    let botName = 'Bot_ChienBinh [Vừa]';
    let botRating = 1350;
    if (difficulty === 'easy') {
      botName = 'Bot_TapSu [Dễ]';
      botRating = 1050;
    } else if (difficulty === 'hard') {
      botName = 'Bot_DaiCaoThu [Khó]';
      botRating = 1850;
    }

    const p2 = {
      socketId: null,
      userId: `bot-${difficulty}-${Date.now()}`,
      username: botName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      fullName: botName,
      rating: botRating,
      isBot: true,
      botDifficulty: difficulty
    };

    this.startMatch(p1, p2);
  }

  leaveQueue(userId) {
    const initialLen = this.waitingQueue.length;
    this.waitingQueue = this.waitingQueue.filter(p => p.userId !== userId);
    if (this.waitingQueue.length !== initialLen && this.io) {
      this.io.to(`user:${userId}`).emit('arena:queue_status', { inQueue: false });
    }
  }

  checkMatchmaking() {
    if (this.waitingQueue.length >= 2) {
      const p1 = this.waitingQueue.shift();
      const p2 = this.waitingQueue.shift();
      this.startMatch(p1, p2);
      return;
    }

    // If a player has waited for more than 10 seconds, pair with AI Rival Challenger
    if (this.waitingQueue.length === 1) {
      const p1 = this.waitingQueue[0];
      if (Date.now() - p1.joinedAt > 10000) {
        this.waitingQueue.shift();
        const botRating = Math.max(1000, p1.rating + Math.floor(Math.random() * 80) - 40);
        const botNames = [
          'CodeMaster_Bot [AI]',
          'CyberNinja [AI]',
          'AlgorithmRival [AI]',
          'SpeedCoder [AI]',
          'BitShift_Pro [AI]'
        ];
        const botName = botNames[Math.floor(Math.random() * botNames.length)];
        const p2 = {
          socketId: null,
          userId: `ai-bot-${Date.now()}`,
          username: botName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          fullName: botName,
          rating: botRating,
          isBot: true
        };
        this.startMatch(p1, p2);
      }
    }
  }

  startMatch(player1, player2) {
    const problems = this.db.getProblems();
    if (!problems || problems.length === 0) {
      if (this.io) {
        this.io.to(`user:${player1.userId}`).emit('arena:error', 'Ngân hàng bài tập hiện chưa có bài nào để thi đấu.');
        if (!player2.isBot) {
          this.io.to(`user:${player2.userId}`).emit('arena:error', 'Ngân hàng bài tập hiện chưa có bài nào để thi đấu.');
        }
      }
      return;
    }

    // Pick a random problem with testcases
    const eligibleProblems = problems.filter(p => p.testCases && p.testCases.length > 0) || problems;
    const selectedProblem = eligibleProblems[Math.floor(Math.random() * eligibleProblems.length)];

    const matchId = newId('duel');
    const now = Date.now();
    const duration = 15 * 60; // 15 minutes = 900s
    const endTime = now + duration * 1000;

    const match = {
      id: matchId,
      status: 'RUNNING',
      startTime: now,
      endTime,
      duration,
      remainingSeconds: duration,
      problemId: selectedProblem.id,
      problemCode: selectedProblem.code,
      problemTitle: selectedProblem.title,
      timeLimit: selectedProblem.timeLimit || 1000,
      memoryLimit: selectedProblem.memoryLimit || 256,
      description: selectedProblem.description || '',
      samples: selectedProblem.samples || [],
      player1: {
        userId: player1.userId,
        username: player1.username,
        fullName: player1.fullName,
        rating: player1.rating,
        score: 0,
        submissionsCount: 0,
        bestStatus: 'QUEUED',
        bestTime: 0,
        acAt: null,
        isBot: !!player1.isBot
      },
      player2: {
        userId: player2.userId,
        username: player2.username,
        fullName: player2.fullName,
        rating: player2.rating,
        score: 0,
        submissionsCount: 0,
        bestStatus: 'QUEUED',
        bestTime: 0,
        acAt: null,
        isBot: !!player2.isBot,
        botDifficulty: player2.botDifficulty || 'medium'
      },
      winnerId: null,
      winReason: null
    };

    this.activeMatches.set(matchId, match);
    this.userMatchMap.set(player1.userId, matchId);
    if (!player2.isBot) {
      this.userMatchMap.set(player2.userId, matchId);
    }

    // Broadcast match start to players
    if (this.io) {
      this.io.to(`user:${player1.userId}`).emit('arena:match_start', this.sanitizeMatchForPlayer(match, player1.userId));
      if (!player2.isBot) {
        this.io.to(`user:${player2.userId}`).emit('arena:match_start', this.sanitizeMatchForPlayer(match, player2.userId));
      }
    }

    // Schedule AI Bot simulated progress if bot
    if (player2.isBot) {
      this.scheduleBotActivity(matchId);
    }
  }

  scheduleBotActivity(matchId) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    const botDifficulty = match.player2.botDifficulty || 'medium';

    let targetScore = 50;
    let submitDelay = 300000;

    if (botDifficulty === 'easy') {
      // Dễ: 10% chance AC, mostly 30-60 points after 4-7 minutes
      const willAC = Math.random() < 0.1;
      targetScore = willAC ? 100 : Math.floor(Math.random() * 35) + 30;
      submitDelay = Math.floor(Math.random() * 180000) + 240000;
    } else if (botDifficulty === 'hard') {
      // Khó: 85% chance AC, speed 1.5 - 3.5 minutes
      const willAC = Math.random() < 0.85;
      targetScore = willAC ? 100 : Math.floor(Math.random() * 20) + 80;
      submitDelay = Math.floor(Math.random() * 120000) + 90000;
    } else {
      // Vừa: 45% chance AC, speed 3 - 6 minutes
      const willAC = Math.random() < 0.45;
      targetScore = willAC ? 100 : Math.floor(Math.random() * 30) + 60;
      submitDelay = Math.floor(Math.random() * 180000) + 180000;
    }

    const botTimeout = setTimeout(() => {
      const currentMatch = this.activeMatches.get(matchId);
      if (!currentMatch || currentMatch.status !== 'RUNNING') return;

      currentMatch.player2.submissionsCount += 1;
      currentMatch.player2.score = targetScore;
      currentMatch.player2.bestStatus = targetScore === 100 ? 'AC' : 'WA';
      currentMatch.player2.bestTime = Math.floor(Math.random() * 150) + 30;

      if (targetScore === 100) {
        currentMatch.player2.acAt = Date.now();
        this.concludeMatch(matchId, currentMatch.player2.userId, 'KNOCKOUT_AC');
      } else {
        if (this.io) {
          this.io.to(`user:${currentMatch.player1.userId}`).emit('arena:opponent_update', {
            opponentScore: currentMatch.player2.score,
            opponentStatus: currentMatch.player2.bestStatus,
            opponentSubmissions: currentMatch.player2.submissionsCount
          });
        }
      }
    }, Math.min(submitDelay, 850000));
    if (botTimeout.unref) botTimeout.unref();
  }

  async handleSubmission(socket, user, data) {
    const matchId = data?.matchId || this.userMatchMap.get(user.id);
    const code = data?.code;

    if (!matchId || !code || !code.trim()) {
      socket.emit('arena:submit_error', 'Dữ liệu nộp bài không hợp lệ');
      return;
    }

    const match = this.activeMatches.get(matchId);
    if (!match || match.status !== 'RUNNING') {
      socket.emit('arena:submit_error', 'Trận đấu đã kết thúc hoặc không tồn tại');
      return;
    }

    const isP1 = match.player1.userId === user.id;
    const player = isP1 ? match.player1 : match.player2;
    const opponent = isP1 ? match.player2 : match.player1;

    player.submissionsCount += 1;
    socket.emit('arena:submit_status', { status: 'JUDGING', message: 'Đang chấm bài thi đấu...' });

    try {
      const fullProblem = this.db.getProblem(match.problemId);
      if (!fullProblem) {
        socket.emit('arena:submit_error', 'Không tìm thấy bài tập trên hệ thống');
        return;
      }

      const dummySub = {
        id: `arena-sub-${Date.now()}`,
        userId: user.id,
        code,
        language: 'cpp'
      };

      const result = await this.judge.gradeSubmission(dummySub, fullProblem);

      // Update player best score
      if (result.score >= player.score) {
        player.score = result.score;
        player.bestStatus = result.status;
        player.bestTime = result.executionTime || 0;
      }

      // Send grading details to the submitter
      socket.emit('arena:my_submission_result', {
        status: result.status,
        score: result.score,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
        compileError: result.compileError,
        details: (result.details || []).map(d => ({
          testIndex: d.testIndex,
          status: d.status,
          time: d.time,
          memory: d.memory
        }))
      });

      // Send telemetry to opponent (without leaking code or test details)
      if (this.io && opponent.userId && !opponent.isBot) {
        this.io.to(`user:${opponent.userId}`).emit('arena:opponent_update', {
          opponentScore: player.score,
          opponentStatus: player.bestStatus,
          opponentSubmissions: player.submissionsCount
        });
      }

      // ── CHECK INSTANT KNOCKOUT WIN CONDITION (First AC 100 pts) ──────────
      if (result.status === 'AC' || result.score === 100) {
        player.acAt = Date.now();
        this.concludeMatch(matchId, user.id, 'KNOCKOUT_AC');
      }
    } catch (err) {
      socket.emit('arena:submit_error', 'Lỗi máy chấm: ' + err.message);
    }
  }

  handleSurrender(userId, matchId) {
    const targetMatchId = matchId || this.userMatchMap.get(userId);
    if (!targetMatchId) return;

    const match = this.activeMatches.get(targetMatchId);
    if (!match || match.status !== 'RUNNING') return;

    const winnerId = match.player1.userId === userId ? match.player2.userId : match.player1.userId;
    this.concludeMatch(targetMatchId, winnerId, 'SURRENDER');
  }

  tick() {
    const now = Date.now();
    for (const [matchId, match] of this.activeMatches.entries()) {
      if (match.status !== 'RUNNING') continue;

      const remaining = Math.max(0, Math.round((match.endTime - now) / 1000));
      match.remainingSeconds = remaining;

      // Broadcast tick every 5 seconds or under 30 seconds every second
      if (remaining % 5 === 0 || remaining <= 10) {
        this.emitToMatch(match, 'arena:timer_tick', { remainingSeconds: remaining });
      }

      // Check timeout (15 minutes elapsed)
      if (remaining <= 0) {
        this.resolveTimeoutMatch(matchId);
      }
    }
  }

  resolveTimeoutMatch(matchId) {
    const match = this.activeMatches.get(matchId);
    if (!match || match.status !== 'RUNNING') return;

    const s1 = match.player1.score;
    const s2 = match.player2.score;

    if (s1 > s2) {
      this.concludeMatch(matchId, match.player1.userId, 'HIGHEST_SCORE');
    } else if (s2 > s1) {
      this.concludeMatch(matchId, match.player2.userId, 'HIGHEST_SCORE');
    } else {
      // Tie
      this.concludeMatch(matchId, null, 'DRAW_TIMEOUT');
    }
  }

  concludeMatch(matchId, winnerId, reason) {
    const match = this.activeMatches.get(matchId);
    if (!match || match.status !== 'RUNNING') return;

    match.status = 'FINISHED';
    match.winnerId = winnerId;
    match.winReason = reason;

    // Calculate rating & stats
    const p1 = match.player1;
    const p2 = match.player2;

    let p1Delta = 0;
    let p2Delta = 0;

    if (winnerId === p1.userId) {
      p1Delta = 25;
      p2Delta = -15;
      this.updateDbRatings(p1.userId, 1, 0, 0, 25);
      if (!p2.isBot) this.updateDbRatings(p2.userId, 0, 1, 0, -15);
    } else if (winnerId === p2.userId) {
      p1Delta = -15;
      p2Delta = 25;
      if (!p1.isBot) this.updateDbRatings(p1.userId, 0, 1, 0, -15);
      if (!p2.isBot) this.updateDbRatings(p2.userId, 1, 0, 0, 25);
    } else {
      // Draw
      p1Delta = 10;
      p2Delta = 10;
      if (!p1.isBot) this.updateDbRatings(p1.userId, 0, 0, 1, 10);
      if (!p2.isBot) this.updateDbRatings(p2.userId, 0, 0, 1, 10);
    }

    match.p1Delta = p1Delta;
    match.p2Delta = p2Delta;

    const summary = {
      matchId,
      winnerId,
      winReason: reason,
      player1: {
        ...p1,
        ratingDelta: p1Delta,
        newRating: p1.rating + p1Delta
      },
      player2: {
        ...p2,
        ratingDelta: p2Delta,
        newRating: p2.rating + p2Delta
      }
    };

    this.emitToMatch(match, 'arena:match_over', summary);

    // Clean up mapping after 5 minutes
    const cleanTimer = setTimeout(() => {
      this.userMatchMap.delete(p1.userId);
      if (!p2.isBot) this.userMatchMap.delete(p2.userId);
      this.activeMatches.delete(matchId);
    }, 300000);
    if (cleanTimer.unref) cleanTimer.unref();
  }

  updateDbRatings(userId, wins, losses, draws, eloDelta) {
    try {
      const user = this.db.getUser(userId);
      if (!user) return;

      user.arenaRating = Math.max(800, (user.arenaRating || 1200) + eloDelta);
      user.arenaWins = (user.arenaWins || 0) + wins;
      user.arenaLosses = (user.arenaLosses || 0) + losses;
      user.arenaDraws = (user.arenaDraws || 0) + draws;
      user.points = (user.points || 0) + (wins > 0 ? 30 : draws > 0 ? 10 : 5);
      this.db.save();
    } catch (e) {
      console.error('Failed to update user arena rating:', e);
    }
  }

  emitToMatch(match, event, data) {
    if (!this.io) return;
    this.io.to(`user:${match.player1.userId}`).emit(event, data);
    if (!match.player2.isBot) {
      this.io.to(`user:${match.player2.userId}`).emit(event, data);
    }
  }

  sanitizeMatchForPlayer(match, userId) {
    const isP1 = match.player1.userId === userId;
    const me = isP1 ? match.player1 : match.player2;
    const opponent = isP1 ? match.player2 : match.player1;

    return {
      matchId: match.id,
      status: match.status,
      startTime: match.startTime,
      endTime: match.endTime,
      remainingSeconds: match.remainingSeconds,
      problem: {
        id: match.problemId,
        code: match.problemCode,
        title: match.problemTitle,
        timeLimit: match.timeLimit,
        memoryLimit: match.memoryLimit,
        description: match.description,
        samples: match.samples
      },
      me,
      opponent: {
        userId: opponent.userId,
        username: opponent.username,
        fullName: opponent.fullName,
        rating: opponent.rating,
        score: opponent.score,
        bestStatus: opponent.bestStatus,
        submissionsCount: opponent.submissionsCount,
        isBot: opponent.isBot
      }
    };
  }

  getArenaLeaderboard() {
    const users = this.db.getUsers() || [];
    return users
      .filter(u => u.role === 'user')
      .map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName || u.username,
        rating: u.arenaRating || 1200,
        wins: u.arenaWins || 0,
        losses: u.arenaLosses || 0,
        draws: u.arenaDraws || 0,
        points: u.points || 0,
        winRate: (u.arenaWins || 0) + (u.arenaLosses || 0) > 0 
          ? Math.round(((u.arenaWins || 0) / ((u.arenaWins || 0) + (u.arenaLosses || 0))) * 100) 
          : 0
      }))
      .sort((a, b) => b.rating - a.rating);
  }

  getUserArenaProfile(userId) {
    const user = this.db.getUser(userId);
    if (!user) return null;
    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      rating: user.arenaRating || 1200,
      wins: user.arenaWins || 0,
      losses: user.arenaLosses || 0,
      draws: user.arenaDraws || 0,
      winRate: (user.arenaWins || 0) + (user.arenaLosses || 0) > 0 
        ? Math.round(((user.arenaWins || 0) / ((user.arenaWins || 0) + (user.arenaLosses || 0))) * 100) 
        : 0
    };
  }
}

module.exports = new ArenaManager();
