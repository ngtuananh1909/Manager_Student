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
  const setup = db.setupFirstAdmin({
    username: 'host', fullName: 'Host', className: 'Tin 1', passwordHash: hostHash
  });
  db.createUser({
    username: 'student', fullName: 'Student', role: 'user', classId: setup.defaultClass.id,
    passwordHash: studentHash
  });

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
  assert.equal(users.body.length, 2);
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
