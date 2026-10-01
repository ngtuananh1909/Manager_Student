const db = require('./db.cjs');
const judge = require('./judge.cjs');
const { sanitizeSubmissionForStudent } = require('./serializers.cjs');

class SubmissionQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.concurrency = 2; // Process 2 submissions concurrently
    this.activeWorkers = 0;
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  enqueue(submissionId) {
    this.queue.push(submissionId);
    if (this.io) {
      this.io.emit('queue:status', {
        queueLength: this.queue.length,
        activeWorkers: this.activeWorkers
      });
    }
    this.processNext();
  }

  async processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const submissionId = this.queue.shift();
    this.activeWorkers++;

    try {
      await this.handleSubmission(submissionId);
    } catch (err) {
      console.error('Error handling submission in queue:', err);
    } finally {
      this.activeWorkers--;
      if (this.io) {
        this.io.emit('queue:status', {
          queueLength: this.queue.length,
          activeWorkers: this.activeWorkers
        });
      }
      this.processNext();
    }
  }

  async handleSubmission(submissionId) {
    const sub = db.getSubmission(submissionId);
    if (!sub) return;

    const problem = db.getProblem(sub.problemId);
    if (!problem) {
      db.updateSubmission(submissionId, { status: 'RE', message: 'Không tìm thấy bài tập' });
      return;
    }

    // Emit start judging
    if (this.io) {
      this.io.to(`user:${sub.userId}`).to(`role:host`).emit(`submission:${submissionId}:status`, { status: 'JUDGING', message: 'Bắt đầu chấm bài...' });
      this.io.to(`user:${sub.userId}`).to('role:host').emit('submission:update', { id: submissionId, status: 'JUDGING' });
    }

    const result = await judge.gradeSubmission(sub, problem, (progress) => {
      if (this.io) {
        this.io.to(`user:${sub.userId}`).to('role:host').emit(`submission:${submissionId}:progress`, progress);
        this.io.to(`user:${sub.userId}`).to('role:host').emit('submission:progress', { id: submissionId, ...progress });
      }
    });

    // Update submission in DB
    const updated = db.updateSubmission(submissionId, {
      status: result.status,
      score: result.score,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      executionTime: result.executionTime,
      memoryUsed: result.memoryUsed,
      compileError: result.compileError,
      details: result.details
    });

    // Check gamification badges
    this.checkGamification(sub.userId, updated, problem);

    // Broadcast results (Sanitize secret inputs/outputs for students)
    const studentResult = sanitizeSubmissionForStudent(updated);

    if (this.io) {
      this.io.to(`user:${sub.userId}`).emit(`submission:${submissionId}:result`, studentResult);
      this.io.to(`user:${sub.userId}`).emit('submission:finished', studentResult);
      this.io.to('role:host').emit(`submission:${submissionId}:result`, updated);
      this.io.to('role:host').emit('submission:finished', updated);
      this.io.to('role:user').to('role:host').emit('leaderboard:update', db.getLeaderboard());
    }
  }

  checkGamification(userId, submission, problem) {
    const user = db.getUser(userId);
    if (!user || user.role !== 'user') return;

    const currentBadges = new Set(user.badges || []);
    let updated = false;

    // Check FIRST_BLOOD (First student to get AC on this problem)
    if (submission.status === 'AC') {
      const otherACs = db.getSubmissions({ problemId: problem.id })
        .filter(s => s.status === 'AC' && s.id !== submission.id);
      if (otherACs.length === 0 && !currentBadges.has('FIRST_BLOOD')) {
        currentBadges.add('FIRST_BLOOD');
        updated = true;
      }

      // Check SPEED_DEMON (< 15ms execution time)
      if (submission.executionTime > 0 && submission.executionTime <= 15 && !currentBadges.has('SPEED_DEMON')) {
        currentBadges.add('SPEED_DEMON');
        updated = true;
      }

      // Check PERFECTIONIST (AC on first submission of this problem)
      const userSubs = db.getSubmissions({ userId, problemId: problem.id });
      if (userSubs.length === 1 && !currentBadges.has('PERFECTIONIST')) {
        currentBadges.add('PERFECTIONIST');
        updated = true;
      }
    }

    if (updated) {
      user.badges = Array.from(currentBadges);
      db.save();
      if (this.io) {
        this.io.to(`user:${user.id}`).emit('badge:unlocked', { userId: user.id, badges: user.badges });
      }
    }
  }
}

module.exports = new SubmissionQueue();
