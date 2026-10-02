const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const argon2 = require('argon2');
const { io: connectSocket } = require('socket.io-client');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schooljudge-api-auth-'));
process.env.SCHOOLJUDGE_DATA_DIR = dataDir;

const db = require('../server/db.cjs');
const { server } = require('../server/index.cjs');

let baseUrl = '';
let hostUser;
let studentUser;
let otherStudentUser;
let contestRecord;
let endedContestRecord;
let freezeContestRecord;
let contestProblem;
let outsideProblem;

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function login(username, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert.equal(result.response.status, 200);
  return result.body;
}

before(async () => {
  const hostHash = await argon2.hash('host-password-123', {
    type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1
  });
  const studentHash = await argon2.hash('student-password-123', {
    type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1
  });
  const otherStudentHash = await argon2.hash('other-password-123', {
    type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1
  });
  const setup = db.setupFirstAdmin({
    username: 'host', fullName: 'Host', className: 'Tin 1', passwordHash: hostHash
  });
  hostUser = setup.admin;
  studentUser = db.createUser({
    username: 'student', fullName: 'Student', role: 'user', classId: setup.defaultClass.id,
    passwordHash: studentHash
  });
  otherStudentUser = db.createUser({
    username: 'other', fullName: 'Other Student', role: 'user', classId: setup.defaultClass.id,
    passwordHash: otherStudentHash
  });
  contestProblem = db.createProblem({
    code: 'IN', title: 'Inside', points: 100,
    testCases: [
      { id: 'hidden', input: 'hidden-input', expectedOutput: 'hidden-output', isSample: false, score: 50 },
      { id: 'sample', input: '1 2', expectedOutput: '3', isSample: true, score: 50 }
    ]
  });
  outsideProblem = db.createProblem({
    code: 'OUT', title: 'Outside', points: 100,
    testCases: [{ id: 'outside', input: 'x', expectedOutput: 'y', isSample: false, score: 100 }]
  });
  contestRecord = db.createContest({
    title: 'Secure contest',
    startTime: new Date(Date.now() - 60_000).toISOString(),
    endTime: new Date(Date.now() + 60 * 60_000).toISOString(),
    status: 'running',
    gradingMode: 'batch_after_deadline',
    classIds: [setup.defaultClass.id],
    candidateIds: [studentUser.id],
    problemIds: [contestProblem.id],
    pinCode: '2468'
  });
  endedContestRecord = db.createContest({
    title: 'Ended contest',
    startTime: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    endTime: new Date(Date.now() - 60 * 60_000).toISOString(),
    status: 'ended',
    durationMinutes: 30,
    classIds: [setup.defaultClass.id],
    problemIds: [contestProblem.id]
  });
  freezeContestRecord = db.createContest({
    title: 'Frozen contest',
    startTime: new Date(Date.now() - 60 * 60_000).toISOString(),
    endTime: new Date(Date.now() + 10 * 60_000).toISOString(),
    status: 'running',
    freezeScoreboardMinutes: 15,
    classIds: [setup.defaultClass.id],
    problemIds: [contestProblem.id]
  });
  const visibleSubmission = db.createSubmission({
    userId: studentUser.id, userName: studentUser.fullName,
    problemId: contestProblem.id, problemCode: contestProblem.code,
    contestId: freezeContestRecord.id, code: 'visible', totalTests: 2
  });
  db.updateSubmission(visibleSubmission.id, {
    status: 'AC', score: 100, submittedAt: new Date(Date.now() - 10 * 60_000).toISOString()
  });
  const frozenSubmission = db.createSubmission({
    userId: studentUser.id, userName: studentUser.fullName,
    problemId: contestProblem.id, problemCode: contestProblem.code,
    contestId: freezeContestRecord.id, code: 'frozen', totalTests: 2
  });
  db.updateSubmission(frozenSubmission.id, { status: 'AC', score: 100, submittedAt: new Date().toISOString() });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.flushSync();
});

process.on('exit', () => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('login returns an opaque session and a safe user DTO', async () => {
  const body = await login('host', 'host-password-123');

  assert.equal(typeof body.accessToken, 'string');
  assert.equal(body.accessToken.length >= 40, true);
  assert.equal(typeof body.expiresAt, 'number');
  assert.equal(body.user.role, 'host');
  assert.equal('passwordHash' in body.user, false);
});

test('protected settings reject missing and student credentials', async () => {
  const unauthenticated = await request('/api/settings');
  assert.equal(unauthenticated.response.status, 401);

  const student = await login('student', 'student-password-123');
  const forbidden = await request('/api/settings', {
    headers: { Authorization: `Bearer ${student.accessToken}` }
  });
  assert.equal(forbidden.response.status, 403);
});

test('host credentials can read settings without leaking password hashes from users', async () => {
  const host = await login('host', 'host-password-123');
  const headers = { Authorization: `Bearer ${host.accessToken}` };

  const settings = await request('/api/settings', { headers });
  assert.equal(settings.response.status, 200);

  const users = await request('/api/users', { headers });
  assert.equal(users.response.status, 200);
  assert.equal(users.body.length, 3);
  assert.equal(users.body.some(user => 'passwordHash' in user), false);
});

test('student credentials are rejected before every privileged route handler', async () => {
  const student = await login('student', 'student-password-123');
  const headers = {
    Authorization: `Bearer ${student.accessToken}`,
    'Content-Type': 'application/json'
  };
  const routes = [
    ['GET', '/api/diagnostics'],
    ['GET', '/api/settings'],
    ['PUT', '/api/settings'],
    ['POST', '/api/problems'],
    ['PUT', '/api/problems/missing'],
    ['DELETE', '/api/problems/missing'],
    ['GET', '/api/problems/missing/testcases'],
    ['PUT', '/api/problems/missing/testcases'],
    ['GET', '/api/sample-tests'],
    ['POST', '/api/sample-tests/import'],
    ['POST', '/api/submissions/toggle-close'],
    ['POST', '/api/grade-all'],
    ['DELETE', '/api/grade-all/cancel'],
    ['POST', '/api/contests'],
    ['PUT', '/api/contests/missing'],
    ['DELETE', '/api/contests/missing'],
    ['POST', '/api/contests/missing/toggle-status'],
    ['GET', '/api/contests/missing/attendance'],
    ['POST', '/api/contests/missing/candidates'],
    ['POST', '/api/contests/missing/extra-time'],
    ['POST', '/api/contests/missing/reopen'],
    ['POST', '/api/contests/missing/suspend'],
    ['GET', '/api/classes'],
    ['POST', '/api/classes'],
    ['GET', '/api/users'],
    ['POST', '/api/users'],
    ['POST', '/api/users/batch'],
    ['PUT', '/api/users/missing/reset-password'],
    ['POST', '/api/users/missing/toggle-lock'],
    ['GET', '/api/anticheat/scan/missing'],
    ['GET', '/api/export/csv'],
    ['GET', '/api/update/info'],
    ['POST', '/api/update/broadcast']
  ];

  for (const [method, pathname] of routes) {
    const result = await request(pathname, {
      method,
      headers,
      body: method === 'GET' || method === 'DELETE' ? undefined : '{}'
    });
    assert.equal(result.response.status, 403, `${method} ${pathname}`);
  }
});

test('Socket.IO rejects anonymous identity and derives online role from the session', async () => {
  const anonymousError = await new Promise(resolve => {
    const socket = connectSocket(baseUrl, { transports: ['websocket'], timeout: 1000 });
    socket.once('connect_error', error => {
      socket.close();
      resolve(error.message);
    });
  });
  assert.equal(anonymousError, 'AUTH_REQUIRED');

  const student = await login('student', 'student-password-123');
  const socket = connectSocket(baseUrl, {
    transports: ['websocket'],
    auth: { token: student.accessToken },
    timeout: 1000
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  const host = await login('host', 'host-password-123');
  const online = await request('/api/users/online', {
    headers: { Authorization: `Bearer ${host.accessToken}` }
  });
  const record = online.body.find(item => item.userId === student.user.id);
  assert.equal(record.role, 'user');
  assert.equal(record.username, 'student');
  socket.close();
});

test('student contest responses hide privileged fields until a successful join', async () => {
  const student = await login('student', 'student-password-123');
  const headers = { Authorization: `Bearer ${student.accessToken}`, 'Content-Type': 'application/json' };

  const list = await request('/api/contests', { headers });
  assert.equal(list.response.status, 200);
  const listed = list.body.find(item => item.id === contestRecord.id);
  assert.equal('pinCode' in listed, false);
  assert.equal('candidateIds' in listed, false);

  const detail = await request(`/api/contests/${contestRecord.id}`, { headers });
  assert.equal(detail.response.status, 200);
  assert.equal(Array.isArray(detail.body.problems), false);

  const wrongPin = await request(`/api/contests/${contestRecord.id}/join`, {
    method: 'POST', headers, body: JSON.stringify({ pinCode: 'wrong' })
  });
  assert.equal(wrongPin.response.status, 403);
  assert.equal(wrongPin.body.code, 'INVALID_CONTEST_PIN');

  const joined = await request(`/api/contests/${contestRecord.id}/join`, {
    method: 'POST', headers, body: JSON.stringify({ pinCode: '2468' })
  });
  assert.equal(joined.response.status, 200);
  assert.equal(joined.body.problems.length, 1);
  assert.deepEqual(joined.body.problems[0].testCases, []);
  assert.equal(JSON.stringify(joined.body).includes('hidden-input'), false);
  assert.equal(JSON.stringify(joined.body).includes('hidden-output'), false);
});

test('official submission derives identity and rejects a problem outside the joined contest', async () => {
  const student = await login('student', 'student-password-123');
  const headers = { Authorization: `Bearer ${student.accessToken}`, 'Content-Type': 'application/json' };
  await request(`/api/contests/${contestRecord.id}/join`, {
    method: 'POST', headers, body: JSON.stringify({ pinCode: '2468' })
  });

  const accepted = await request('/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: hostUser.id,
      userName: 'Spoofed host',
      problemId: contestProblem.id,
      contestId: contestRecord.id,
      code: 'int main(){return 0;}'
    })
  });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.userId, studentUser.id);
  assert.equal(accepted.body.userName, studentUser.fullName);

  await new Promise(resolve => setTimeout(resolve, 2100));
  const outside = await request('/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      problemId: outsideProblem.id,
      contestId: contestRecord.id,
      code: 'int main(){return 0;}'
    })
  });
  assert.equal(outside.response.status, 403);
  assert.equal(outside.body.code, 'PROBLEM_NOT_IN_CONTEST');
});

test('student submission reads are ownership-scoped and full-test details are host-only', async () => {
  db.createSubmission({
    userId: hostUser.id,
    userName: hostUser.fullName,
    problemId: contestProblem.id,
    problemCode: contestProblem.code,
    code: 'host-secret-code',
    totalTests: 2
  });
  const student = await login('student', 'student-password-123');
  const studentHeaders = { Authorization: `Bearer ${student.accessToken}` };
  const list = await request('/api/submissions', { headers: studentHeaders });
  assert.equal(list.response.status, 200);
  assert.equal(list.body.every(item => item.userId === studentUser.id), true);
  assert.equal(JSON.stringify(list.body).includes('host-secret-code'), false);

  const own = list.body[0];
  const forbidden = await request(`/api/submissions/${own.id}/full-test/1`, { headers: studentHeaders });
  assert.equal(forbidden.response.status, 403);
});

test('virtual sessions derive ownership and reject cross-user access', async () => {
  const student = await login('student', 'student-password-123');
  const other = await login('other', 'other-password-123');
  const studentHeaders = { Authorization: `Bearer ${student.accessToken}`, 'Content-Type': 'application/json' };
  const otherHeaders = { Authorization: `Bearer ${other.accessToken}`, 'Content-Type': 'application/json' };

  const runningStart = await request(`/api/contests/${contestRecord.id}/virtual-start`, {
    method: 'POST', headers: studentHeaders, body: JSON.stringify({ userId: otherStudentUser.id })
  });
  assert.equal(runningStart.response.status, 403);

  const started = await request(`/api/contests/${endedContestRecord.id}/virtual-start`, {
    method: 'POST', headers: studentHeaders,
    body: JSON.stringify({ userId: otherStudentUser.id, userName: 'Spoofed' })
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.body.userId, studentUser.id);
  assert.equal(started.body.userName, studentUser.fullName);

  const otherList = await request(`/api/contests/${endedContestRecord.id}/virtual-sessions?userId=${studentUser.id}`, {
    headers: otherHeaders
  });
  assert.equal(otherList.response.status, 200);
  assert.equal(otherList.body.some(item => item.id === started.body.id), false);

  const forbiddenFinish = await request(`/api/virtual-sessions/${started.body.id}/finish`, {
    method: 'POST', headers: otherHeaders, body: '{}'
  });
  assert.equal(forbiddenFinish.response.status, 403);
});

test('student leaderboard freezes while host leaderboard remains live', async () => {
  const student = await login('student', 'student-password-123');
  const host = await login('host', 'host-password-123');
  const studentBoard = await request(`/api/contests/${freezeContestRecord.id}/leaderboard`, {
    headers: { Authorization: `Bearer ${student.accessToken}` }
  });
  const hostBoard = await request(`/api/contests/${freezeContestRecord.id}/leaderboard`, {
    headers: { Authorization: `Bearer ${host.accessToken}` }
  });

  const studentEntry = studentBoard.body.find(item => item.userId === studentUser.id);
  const hostEntry = hostBoard.body.find(item => item.userId === studentUser.id);
  assert.equal(studentEntry.totalSubmissions, 1);
  assert.equal(hostEntry.totalSubmissions, 2);
});
