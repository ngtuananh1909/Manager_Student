const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  AuthError,
  createAuthService,
  hashPassword,
  safeUser
} = require('../server/auth.cjs');

function createRepository() {
  const users = [];
  const classes = [{ id: 'cls-1', name: 'Tin 1', joinCode: 'TIN01' }];
  return {
    users,
    classes,
    getUser(id) {
      return users.find(user => user.id === id || user.username === id) || null;
    },
    getClasses() {
      return classes;
    },
    createUser(user) {
      const created = {
        id: `usr-${users.length + 1}`,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        classId: user.classId,
        passwordHash: user.passwordHash,
        mustChangePassword: !!user.mustChangePassword,
        isLocked: false
      };
      users.push(created);
      return created;
    },
    setUserPasswordHash(id, passwordHash, mustChangePassword = false) {
      const user = this.getUser(id);
      user.passwordHash = passwordHash;
      user.mustChangePassword = mustChangePassword;
      return user;
    }
  };
}

test('safeUser never exposes passwordHash', async () => {
  const user = {
    id: 'usr-1',
    username: 'student',
    passwordHash: 'secret-hash',
    fullName: 'Student',
    role: 'user',
    classId: 'cls-1'
  };

  assert.deepEqual(safeUser(user), {
    id: 'usr-1',
    username: 'student',
    fullName: 'Student',
    role: 'user',
    classId: 'cls-1',
    classes: ['cls-1'],
    isLocked: false,
    mustChangePassword: false,
    streak: 0,
    badges: [],
    points: 0
  });
});

test('login migrates a matching legacy SHA-256 password to Argon2id', async () => {
  const repository = createRepository();
  repository.users.push({
    id: 'usr-1',
    username: 'legacy',
    fullName: 'Legacy User',
    role: 'user',
    classId: 'cls-1',
    isLocked: false,
    passwordHash: crypto.createHash('sha256').update('correct horse battery staple').digest('hex')
  });
  const auth = createAuthService(repository);

  const result = await auth.login('legacy', 'correct horse battery staple');

  assert.match(repository.users[0].passwordHash, /^\$argon2id\$/);
  assert.equal(result.user.username, 'legacy');
  assert.equal('passwordHash' in result.user, false);
  assert.equal(typeof result.accessToken, 'string');
});

test('login rejects users with a missing password hash', async () => {
  const repository = createRepository();
  repository.users.push({
    id: 'usr-1', username: 'broken', fullName: 'Broken', role: 'user', classId: 'cls-1'
  });
  const auth = createAuthService(repository);

  await assert.rejects(
    () => auth.login('broken', 'anything'),
    error => error instanceof AuthError && error.code === 'INVALID_CREDENTIALS'
  );
});

test('registration requires the matching class join code', async () => {
  const repository = createRepository();
  const auth = createAuthService(repository);

  await assert.rejects(
    () => auth.registerStudent({
      username: 'student', password: 'long-enough-password', fullName: 'Student', joinCode: 'WRONG'
    }),
    error => error instanceof AuthError && error.code === 'INVALID_JOIN_CODE'
  );

  const result = await auth.registerStudent({
    username: 'student', password: 'long-enough-password', fullName: 'Student', joinCode: 'tin01'
  });
  assert.equal(result.user.classId, 'cls-1');
  assert.match(repository.users[0].passwordHash, /^\$argon2id\$/);
});

test('opaque sessions expire after the configured absolute lifetime', async () => {
  let now = 1_000;
  const repository = createRepository();
  repository.createUser({
    username: 'student',
    fullName: 'Student',
    role: 'user',
    classId: 'cls-1',
    passwordHash: await hashPassword('long-enough-password')
  });
  const auth = createAuthService(repository, { now: () => now, sessionTtlMs: 500 });
  const loggedIn = await auth.login('student', 'long-enough-password');

  assert.equal(auth.resolveAccessToken(loggedIn.accessToken).username, 'student');
  now = 1_501;
  assert.equal(auth.resolveAccessToken(loggedIn.accessToken), null);
});

test('hashPassword accepts passwords under 10 characters', async () => {
  const hash123 = await hashPassword('123');
  assert.match(hash123, /^\$argon2id\$/);

  const hash123456 = await hashPassword('123456');
  assert.match(hash123456, /^\$argon2id\$/);

  await assert.rejects(
    () => hashPassword(''),
    error => error instanceof AuthError && error.code === 'INVALID_PASSWORD'
  );
});
