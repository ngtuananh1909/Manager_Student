'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let pool, usersRepo, classesRepo, problemsRepo, contestsRepo, submissionsRepo, leaderboardRepo;
let pgAvailable = false;
try {
  require.resolve('pg');
  pool = require('../server/database/pool.cjs');
  usersRepo = require('../server/database/repos/users.cjs');
  classesRepo = require('../server/database/repos/classes.cjs');
  problemsRepo = require('../server/database/repos/problems.cjs');
  contestsRepo = require('../server/database/repos/contests.cjs');
  submissionsRepo = require('../server/database/repos/submissions.cjs');
  leaderboardRepo = require('../server/database/repos/leaderboard.cjs');
  pgAvailable = true;
} catch (e) {}

test('PostgreSQL Database Repositories Integration Test', { skip: !pgAvailable && 'pg module not installed' }, async (t) => {
  const testSuffix = Date.now();

  await t.test('1. Test Connection', async () => {
    const conn = await pool.testConnection();
    assert.equal(conn.ok, true, `Connection failed: ${conn.error}`);
  });

  let testClass1, testClass2;
  await t.test('2. Classes & N:N Enrollment', async () => {
    testClass1 = await classesRepo.createClass({
      name: `Lớp 11A1_${testSuffix}`,
      grade: 11,
      teacher: 'Thầy Hùng'
    });
    testClass2 = await classesRepo.createClass({
      name: `Lớp Chuyên Tin_${testSuffix}`,
      grade: 11,
      teacher: 'Cô Mai'
    });

    assert.ok(testClass1.id);
    assert.equal(testClass1.grade, 11);
  });

  let testStudent;
  await t.test('3. Users & Multi-class Enrollment', async () => {
    testStudent = await usersRepo.createUser({
      username: `student_${testSuffix}`,
      passwordHash: usersRepo.hashPassword('pass123'),
      fullName: 'Học Sinh Thử Nghiệm',
      role: 'user',
      classes: [testClass1.id, testClass2.id]
    });

    assert.ok(testStudent.id);
    assert.equal(testStudent.classes.length, 2);
    assert.ok(testStudent.classes.includes(testClass1.id));
    assert.ok(testStudent.classes.includes(testClass2.id));

    // Authenticate test
    const authSuccess = await usersRepo.authenticate(`student_${testSuffix}`, 'pass123');
    assert.ok(authSuccess);
    assert.equal(authSuccess.id, testStudent.id);

    const authFail = await usersRepo.authenticate(`student_${testSuffix}`, 'wrongpass');
    assert.equal(authFail, null);
  });

  let testProblem;
  await t.test('4. Problems & Hybrid Testcase Storage', async () => {
    testProblem = await problemsRepo.createProblem({
      code: `SUM_${testSuffix}`,
      title: 'Tính Tổng Hai Số',
      difficulty: 'Dễ',
      points: 100,
      timeLimit: 1000,
      memoryLimit: 256,
      testCases: [
        { name: 'test01', score: 50, input: '1 2\n', expectedOutput: '3\n', isSample: true },
        { name: 'test02', score: 50, input: '10 20\n', expectedOutput: '30\n', isSample: false }
      ]
    });

    assert.ok(testProblem.id);
    assert.equal(testProblem.testCount, 2);

    // Read back testcases
    const readTestCases = await problemsRepo.getProblemTestCases(testProblem.id);
    assert.equal(readTestCases.length, 2);
    assert.equal(readTestCases[0].input.trim(), '1 2');
    assert.equal(readTestCases[0].expectedOutput.trim(), '3');
    assert.equal(readTestCases[1].input.trim(), '10 20');
    assert.equal(readTestCases[1].expectedOutput.trim(), '30');
  });

  let testContest;
  await t.test('5. Contests & AGENTS.md Eligibility Checking', async () => {
    testContest = await contestsRepo.createContest({
      title: `Kỳ Thi Tin Học_${testSuffix}`,
      scopeType: 'CLASS',
      targetClasses: [testClass1.id], // Chỉ lớp 11A1 được thi
      problemIds: [testProblem.id],
      durationMinutes: 45
    });

    assert.ok(testContest.id);

    // Học sinh thuộc 11A1 -> Eligible: true
    const isEligible = await contestsRepo.isStudentEligible(testStudent, testContest);
    assert.equal(isEligible, true);

    // Tạo học sinh khác không thuộc 11A1 -> Eligible: false
    const otherStudent = await usersRepo.createUser({
      username: `other_${testSuffix}`,
      passwordHash: usersRepo.hashPassword('pass123'),
      fullName: 'Học Sinh Ngoài Lớp',
      role: 'user',
      classes: [] // Không thuộc lớp nào
    });
    const notEligible = await contestsRepo.isStudentEligible(otherStudent, testContest);
    assert.equal(notEligible, false);

    // Dọn dẹp otherStudent
    await usersRepo.deleteUser(otherStudent.id);
  });

  let testSubmission;
  await t.test('6. Submissions & Scoring', async () => {
    testSubmission = await submissionsRepo.createSubmission({
      userId: testStudent.id,
      problemId: testProblem.id,
      contestId: testContest.id,
      code: '#include <iostream>\nusing namespace std;\nint main() { int a, b; cin >> a >> b; cout << a + b << endl; return 0; }'
    });

    assert.ok(testSubmission.id);
    assert.equal(testSubmission.status, 'QUEUED');

    // Giả lập kết quả chấm bài
    const updatedSub = await submissionsRepo.updateSubmission(testSubmission.id, {
      status: 'AC',
      score: 100,
      passedTests: 2,
      totalTests: 2,
      executionTime: 15,
      memoryUsed: 2.5,
      details: [
        { testIndex: 1, name: 'test01', status: 'AC', time: 7, memory: 2.1, scoreEarned: 50 },
        { testIndex: 2, name: 'test02', status: 'AC', time: 8, memory: 2.5, scoreEarned: 50 }
      ]
    });

    assert.equal(updatedSub.status, 'AC');
    assert.equal(updatedSub.score, 100);
    assert.equal(updatedSub.details.length, 2);
  });

  await t.test('7. Contest Leaderboard', async () => {
    const leaderboard = await leaderboardRepo.getContestLeaderboard(testContest.id);
    assert.ok(leaderboard.length >= 1);
    const myRank = leaderboard.find(r => r.userId === testStudent.id);
    assert.ok(myRank);
    assert.equal(myRank.totalScore, 100);
    assert.equal(myRank.rank, 1);
  });

  await t.test('8. Cleanup Test Entities', async () => {
    if (testSubmission) await submissionsRepo.deleteSubmission(testSubmission.id);
    if (testContest) await contestsRepo.deleteContest(testContest.id);
    if (testProblem) await problemsRepo.deleteProblem(testProblem.id);
    if (testStudent) await usersRepo.deleteUser(testStudent.id);
    if (testClass1) await classesRepo.deleteClass(testClass1.id);
    if (testClass2) await classesRepo.deleteClass(testClass2.id);
  });
});
