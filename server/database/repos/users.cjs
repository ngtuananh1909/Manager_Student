'use strict';

const crypto = require('crypto');
const { query, transaction } = require('../pool.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Lấy danh sách toàn bộ người dùng kèm theo danh sách ID lớp học của họ
 */
async function getUsers() {
  const sql = `
    SELECT 
      u.id, u.username, u.password_hash AS "passwordHash", u.full_name AS "fullName",
      u.role, u.streak, u.is_locked AS "isLocked", u.must_change_password AS "mustChangePassword",
      u.created_at AS "createdAt",
      COALESCE(
        array_agg(se.class_id) FILTER (WHERE se.class_id IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS classes
    FROM users u
    LEFT JOIN student_enrollments se ON se.student_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `;
  const res = await query(sql);
  return res.rows.map(row => ({
    ...row,
    classId: row.classes[0] || 'cls-1'
  }));
}

/**
 * Tìm người dùng theo ID hoặc username
 */
async function getUser(idOrUsername) {
  if (!idOrUsername) return null;
  const sql = `
    SELECT 
      u.id, u.username, u.password_hash AS "passwordHash", u.full_name AS "fullName",
      u.role, u.streak, u.is_locked AS "isLocked", u.must_change_password AS "mustChangePassword",
      u.created_at AS "createdAt",
      COALESCE(
        array_agg(se.class_id) FILTER (WHERE se.class_id IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS classes
    FROM users u
    LEFT JOIN student_enrollments se ON se.student_id = u.id
    WHERE u.id = $1 OR LOWER(u.username) = LOWER($1)
    GROUP BY u.id
  `;
  const res = await query(sql, [idOrUsername]);
  if (res.rows.length === 0) return null;
  const user = res.rows[0];
  user.classId = user.classes[0] || 'cls-1';
  return user;
}

/**
 * Tạo người dùng mới
 */
async function createUser(user) {
  if (!user.passwordHash) {
    const error = new Error('A pre-hashed password is required');
    error.code = 'PASSWORD_HASH_REQUIRED';
    throw error;
  }

  const id = user.id || newId('usr');
  const username = user.username.trim().toLowerCase();
  const fullName = user.fullName || user.username;
  const role = user.role || 'user';
  const streak = Number(user.streak) || 1;
  const isLocked = !!user.isLocked;
  const mustChangePassword = !!user.mustChangePassword;

  // Xử lý các lớp học (N:N)
  let classes = Array.isArray(user.classes) && user.classes.length > 0
    ? user.classes
    : (user.classId ? [user.classId] : []);

  return await transaction(async (client) => {
    // Nếu chưa có lớp nào chỉ định và là user thường, tìm lớp đầu tiên
    if (classes.length === 0 && role === 'user') {
      const clsRes = await client.query('SELECT id FROM classes ORDER BY created_at ASC LIMIT 1');
      if (clsRes.rows.length > 0) classes = [clsRes.rows[0].id];
    }

    const insertUserSql = `
      INSERT INTO users (id, username, password_hash, full_name, role, streak, is_locked, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, password_hash AS "passwordHash", full_name AS "fullName",
                role, streak, is_locked AS "isLocked", must_change_password AS "mustChangePassword",
                created_at AS "createdAt"
    `;
    const res = await client.query(insertUserSql, [
      id, username, user.passwordHash, fullName, role, streak, isLocked, mustChangePassword
    ]);
    const created = res.rows[0];

    // Ghi vào bảng student_enrollments
    for (const classId of classes) {
      await client.query(`
        INSERT INTO student_enrollments (student_id, class_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [id, classId]);
    }

    created.classes = classes;
    created.classId = classes[0] || null;
    return created;
  });
}

/**
 * Cập nhật thông tin người dùng
 */
async function updateUser(id, updates = {}) {
  const current = await getUser(id);
  if (!current) return null;

  await transaction(async (client) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.fullName !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(updates.fullName.trim());
    }
    if (updates.isLocked !== undefined) {
      fields.push(`is_locked = $${idx++}`);
      values.push(!!updates.isLocked);
    }
    if (updates.streak !== undefined) {
      fields.push(`streak = $${idx++}`);
      values.push(Number(updates.streak));
    }
    if (updates.mustChangePassword !== undefined) {
      fields.push(`must_change_password = $${idx++}`);
      values.push(!!updates.mustChangePassword);
    }

    if (fields.length > 0) {
      values.push(current.id);
      const updateSql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`;
      await client.query(updateSql, values);
    }

    // Cập nhật quan hệ lớp học nếu có
    if (Array.isArray(updates.classes)) {
      await client.query('DELETE FROM student_enrollments WHERE student_id = $1', [current.id]);
      for (const classId of updates.classes) {
        await client.query(
          'INSERT INTO student_enrollments (student_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [current.id, classId]
        );
      }
    } else if (updates.classId) {
      await client.query('DELETE FROM student_enrollments WHERE student_id = $1', [current.id]);
      await client.query(
        'INSERT INTO student_enrollments (student_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [current.id, updates.classId]
      );
    }
  });

  return await getUser(current.id);
}

/**
 * Đổi mật khẩu người dùng
 */
async function setUserPasswordHash(id, passwordHash, mustChangePassword = false) {
  if (!passwordHash) {
    const error = new Error('A pre-hashed password is required');
    error.code = 'PASSWORD_HASH_REQUIRED';
    throw error;
  }
  const sql = `
    UPDATE users 
    SET password_hash = $1, must_change_password = $2 
    WHERE id = $3 OR LOWER(username) = LOWER($3)
    RETURNING id
  `;
  const res = await query(sql, [passwordHash, !!mustChangePassword, id]);
  if (res.rows.length === 0) return null;
  return await getUser(res.rows[0].id);
}

/**
 * Bật/tắt trạng thái khóa tài khoản
 */
async function toggleUserLock(id) {
  const current = await getUser(id);
  if (!current) return null;
  const newLock = !current.isLocked;
  await query('UPDATE users SET is_locked = $1 WHERE id = $2', [newLock, current.id]);
  current.isLocked = newLock;
  return current;
}

/**
 * Xóa người dùng
 */
async function deleteUser(id) {
  const res = await query('DELETE FROM users WHERE id = $1 OR LOWER(username) = LOWER($1) RETURNING id', [id]);
  return res.rows.length > 0;
}

/**
 * Xác thực tài khoản đăng nhập
 */
async function authenticate(username, password) {
  if (!username) return null;
  const user = await getUser(username.trim());
  if (!user) return null;

  const hash = hashPassword(password);
  if (user.passwordHash && user.passwordHash !== hash) {
    return null;
  }
  return user;
}

/**
 * Kiểm tra xem hệ thống có phải lần đầu chạy (chưa có tài khoản admin/host nào)
 */
async function isFirstRun() {
  const res = await query("SELECT COUNT(*) AS count FROM users WHERE role IN ('host', 'admin')");
  return parseInt(res.rows[0].count, 10) === 0;
}

/**
 * Thiết lập tài khoản Admin đầu tiên khi mới cài đặt
 */
async function setupFirstAdmin(adminData) {
  if (!adminData.passwordHash) {
    const error = new Error('A pre-hashed password is required');
    error.code = 'PASSWORD_HASH_REQUIRED';
    throw error;
  }

  return await transaction(async (client) => {
    const adminId = newId('usr');
    const classId = newId('cls');

    // 1. Tạo lớp mặc định
    const className = adminData.className || "Lớp Tin Học 1";
    await client.query(`
      INSERT INTO classes (id, name, teacher, join_code)
      VALUES ($1, $2, $3, $4)
    `, [classId, className, adminData.fullName || "Quản trị viên / Giáo viên", "TIN01"]);

    // 2. Tạo tài khoản Host
    const insertAdminSql = `
      INSERT INTO users (id, username, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, 'host')
      RETURNING id, username, password_hash AS "passwordHash", full_name AS "fullName", role, created_at AS "createdAt"
    `;
    const adminRes = await client.query(insertAdminSql, [
      adminId, adminData.username.trim().toLowerCase(), adminData.passwordHash, adminData.fullName || "Quản trị viên / Giáo viên"
    ]);

    // 3. Cập nhật serverName nếu có
    if (adminData.serverName) {
      await client.query(`
        INSERT INTO settings (key, value)
        VALUES ('serverName', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [JSON.stringify(adminData.serverName.trim())]);
    }

    return {
      admin: adminRes.rows[0],
      defaultClass: { id: classId, name: className, teacher: adminData.fullName, joinCode: "TIN01" }
    };
  });
}

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  setUserPasswordHash,
  toggleUserLock,
  deleteUser,
  authenticate,
  isFirstRun,
  setupFirstAdmin,
  hashPassword
};
