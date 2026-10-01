const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const dbModule = path.join(repoRoot, 'server', 'db.cjs');

function runIsolated(script) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'schooljudge-db-test-'));
  const dataDir = path.join(root, 'data');
  const cwd = path.join(root, 'cwd');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(cwd);

  try {
    const output = execFileSync(process.execPath, ['-e', script], {
      cwd,
      env: {
        ...process.env,
        SCHOOLJUDGE_DATA_DIR: dataDir,
        SCHOOLJUDGE_DB_MODULE: dbModule
      },
      encoding: 'utf8'
    });
    return { output, dataDir, cwd };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('SCHOOLJUDGE_DATA_DIR keeps runtime data out of the application checkout', () => {
  const result = runIsolated(`
    const fs = require('node:fs');
    const path = require('node:path');
    const db = require(process.env.SCHOOLJUDGE_DB_MODULE);
    db.flushSync();
    process.stdout.write(JSON.stringify({
      dataFileExists: fs.existsSync(path.join(process.env.SCHOOLJUDGE_DATA_DIR, 'schooljudge_data.json')),
      cwdDataExists: fs.existsSync(path.join(process.cwd(), 'schooljudge_data.json'))
    }));
  `);

  assert.deepEqual(JSON.parse(result.output), {
    dataFileExists: true,
    cwdDataExists: false
  });
});

test('new persisted entity IDs remain unique when created in the same millisecond', () => {
  const result = runIsolated(`
    Date.now = () => 1234567890;
    const db = require(process.env.SCHOOLJUDGE_DB_MODULE);
    const first = db.createClass({ name: 'A' });
    const second = db.createClass({ name: 'B' });
    process.stdout.write(JSON.stringify({ first: first.id, second: second.id }));
  `);

  const ids = JSON.parse(result.output);
  assert.notEqual(ids.first, ids.second);
  assert.match(ids.first, /^cls-[0-9a-f-]{36}$/);
  assert.match(ids.second, /^cls-[0-9a-f-]{36}$/);
});

test('user persistence accepts only pre-hashed passwords and can rotate the hash', () => {
  const result = runIsolated(`
    const db = require(process.env.SCHOOLJUDGE_DB_MODULE);
    let missingHashRejected = false;
    try {
      db.createUser({ username: 'unsafe', fullName: 'Unsafe', role: 'user', classId: 'cls-1' });
    } catch (error) {
      missingHashRejected = error.code === 'PASSWORD_HASH_REQUIRED';
    }
    const user = db.createUser({
      username: 'safe', fullName: 'Safe', role: 'user', classId: 'cls-1',
      passwordHash: '$argon2id$initial', mustChangePassword: true
    });
    db.setUserPasswordHash(user.id, '$argon2id$rotated', false);
    const updated = db.getUser(user.id);
    process.stdout.write(JSON.stringify({
      missingHashRejected,
      passwordHash: updated.passwordHash,
      mustChangePassword: updated.mustChangePassword
    }));
  `);

  assert.deepEqual(JSON.parse(result.output), {
    missingHashRejected: true,
    passwordHash: '$argon2id$rotated',
    mustChangePassword: false
  });
});
