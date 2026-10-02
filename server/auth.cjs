const crypto = require('crypto');
const argon2 = require('argon2');

const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32
});

class AuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function hashAccessToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isLegacySha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

function legacyPasswordMatches(password, storedHash) {
  if (!isLegacySha256(storedHash)) return false;
  const actual = Buffer.from(
    crypto.createHash('sha256').update(String(password || '')).digest('hex'),
    'utf8'
  );
  const expected = Buffer.from(String(storedHash).toLowerCase(), 'utf8');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function hashPassword(password) {
  const normalized = String(password || '');
  if (!normalized || normalized.length > 128) {
    throw new AuthError('INVALID_PASSWORD', 'Mật khẩu không được để trống và tối đa 128 ký tự.');
  }
  return argon2.hash(normalized, ARGON2_OPTIONS);
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role === 'host' ? 'host' : 'user',
    classId: user.classId || '',
    classes: Array.isArray(user.classes) ? [...user.classes] : (user.classId ? [user.classId] : []),
    isLocked: !!user.isLocked,
    mustChangePassword: !!user.mustChangePassword,
    streak: Number(user.streak) || 0,
    badges: Array.isArray(user.badges) ? [...user.badges] : [],
    points: Number(user.points) || 0
  };
}

function createAuthService(repository, options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const sessionTtlMs = Number(options.sessionTtlMs) || 8 * 60 * 60 * 1000;
  const sessions = new Map();
  const dummyHashPromise = hashPassword('schooljudge-invalid-password');

  function createSession(userId) {
    const accessToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashAccessToken(accessToken);
    const expiresAt = now() + sessionTtlMs;
    sessions.set(tokenHash, {
      userId,
      expiresAt,
      joinedContests: new Set()
    });
    return { accessToken, expiresAt };
  }

  function getSession(accessToken) {
    if (!accessToken) return null;
    const tokenHash = hashAccessToken(accessToken);
    const session = sessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= now()) {
      sessions.delete(tokenHash);
      return null;
    }
    const user = repository.getUser(session.userId);
    if (!user || user.isLocked) {
      sessions.delete(tokenHash);
      return null;
    }
    return { tokenHash, session, user };
  }

  function resolveAccessToken(accessToken) {
    const resolved = getSession(accessToken);
    return resolved ? safeUser(resolved.user) : null;
  }

  async function verifyPassword(user, password) {
    const storedHash = String(user?.passwordHash || '');
    if (!storedHash) return false;
    if (storedHash.startsWith('$argon2id$')) {
      try {
        return await argon2.verify(storedHash, String(password || ''));
      } catch {
        return false;
      }
    }
    if (!legacyPasswordMatches(password, storedHash)) return false;
    const upgraded = await hashPassword(password);
    repository.setUserPasswordHash(user.id, upgraded, !!user.mustChangePassword);
    return true;
  }

  async function login(username, password) {
    const normalizedUsername = normalizeUsername(username);
    const user = repository.getUser(normalizedUsername);
    if (!user) {
      try {
        await argon2.verify(await dummyHashPromise, String(password || ''));
      } catch {
        // Keep the externally visible error identical to a bad password.
      }
      throw new AuthError('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.', 401);
    }
    if (user.isLocked) {
      throw new AuthError('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa.', 403);
    }
    if (!(await verifyPassword(user, password))) {
      throw new AuthError('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.', 401);
    }
    const session = createSession(user.id);
    return { ...session, user: safeUser(user) };
  }

  async function registerStudent(input) {
    const username = normalizeUsername(input?.username);
    const fullName = String(input?.fullName || '').trim();
    const joinCode = String(input?.joinCode || '').trim().toUpperCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new AuthError('INVALID_USERNAME', 'Tên đăng nhập phải có 3-32 ký tự hợp lệ.');
    }
    if (!fullName || fullName.length > 100) {
      throw new AuthError('INVALID_FULL_NAME', 'Họ tên không hợp lệ.');
    }
    if (repository.getUser(username)) {
      throw new AuthError('USERNAME_EXISTS', 'Tên đăng nhập đã tồn tại.', 409);
    }
    const targetClass = (repository.getClasses() || []).find(
      item => String(item.joinCode || '').trim().toUpperCase() === joinCode
    );
    if (!targetClass) {
      throw new AuthError('INVALID_JOIN_CODE', 'Mã tham gia lớp không hợp lệ.', 403);
    }
    const passwordHash = await hashPassword(input.password);
    const user = repository.createUser({
      username,
      fullName,
      role: 'user',
      classId: targetClass.id,
      passwordHash,
      mustChangePassword: false
    });
    const session = createSession(user.id);
    return { ...session, user: safeUser(user) };
  }

  function revokeAccessToken(accessToken) {
    if (accessToken) sessions.delete(hashAccessToken(accessToken));
  }

  function revokeUserSessions(userId) {
    for (const [tokenHash, session] of sessions.entries()) {
      if (session.userId === userId) sessions.delete(tokenHash);
    }
  }

  async function changePassword(userId, currentPassword, newPassword) {
    const user = repository.getUser(userId);
    if (!user || !(await verifyPassword(user, currentPassword))) {
      throw new AuthError('INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.', 401);
    }
    const passwordHash = await hashPassword(newPassword);
    repository.setUserPasswordHash(user.id, passwordHash, false);
    revokeUserSessions(user.id);
    return safeUser(repository.getUser(user.id));
  }

  function markContestJoined(accessToken, contestId) {
    const resolved = getSession(accessToken);
    if (!resolved) return false;
    resolved.session.joinedContests.add(contestId);
    return true;
  }

  function hasJoinedContest(accessToken, contestId) {
    const resolved = getSession(accessToken);
    return !!resolved?.session.joinedContests.has(contestId);
  }

  function authenticate(req, res, next) {
    const authorization = String(req.headers.authorization || '');
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    const accessToken = match ? match[1] : '';
    const resolved = getSession(accessToken);
    if (!resolved) {
      return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
    req.accessToken = accessToken;
    req.user = safeUser(resolved.user);
    next();
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ code: 'FORBIDDEN', error: 'Bạn không có quyền thực hiện thao tác này.' });
      }
      next();
    };
  }

  return {
    authenticate,
    changePassword,
    hasJoinedContest,
    login,
    markContestJoined,
    registerStudent,
    requireRole,
    resolveAccessToken,
    revokeAccessToken,
    revokeUserSessions
  };
}

module.exports = {
  ARGON2_OPTIONS,
  AuthError,
  createAuthService,
  hashPassword,
  safeUser
};
