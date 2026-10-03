'use strict';

const { Pool } = require('pg');

const poolConfig = {
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'schooljudge',
  user: process.env.PG_USER || 'sj_admin',
  password: process.env.PG_PASSWORD || 'sj_secret_local_lan_2026',
  max: 20, // Tối đa 20 kết nối trong pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
};

const pool = new Pool(poolConfig);

// Lắng nghe lỗi bất ngờ từ idle client trong pool
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Lỗi kết nối bất ngờ từ client rảnh:', err);
});

/**
 * Thực thi một câu lệnh SQL đơn với tham số an toàn
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL) {
      console.log(`[SQL ${duration}ms]:`, text.trim().substring(0, 100));
    }
    return res;
  } catch (err) {
    console.error(`[SQL Error]: ${err.message}\nQuery: ${text}\nParams:`, params);
    throw err;
  }
}

/**
 * Quản lý Transaction an toàn: Tự động BEGIN, COMMIT, ROLLBACK
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[SQL Transaction] Lỗi khi Rollback:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Kiểm tra kết nối tới cơ sở dữ liệu
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS current_time, version()');
    return { ok: true, version: res.rows[0].version, time: res.rows[0].current_time };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Đóng connection pool an toàn khi tắt server
 */
async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  close
};
