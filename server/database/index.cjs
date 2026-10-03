'use strict';

/**
 * ChauCaoJudge LAN — Dual-Mode Database Facade
 * 
 * Hỗ trợ chuyển đổi linh hoạt:
 * - 'postgres' (Mặc định): Chạy qua PostgreSQL 16 (Docker) + Phương án B (Hybrid).
 * - 'json' (Fallback an toàn): Chạy qua file schooljudge_data.json truyền thống (server/db.cjs).
 */

const mode = (process.env.SCHOOLJUDGE_DB_MODE || 'postgres').toLowerCase();

if (mode === 'json') {
  console.log('📦 [Database Mode]: Đang chạy ở chế độ Fallback JSON (schooljudge_data.json)');
  module.exports = require('../db.cjs');
} else {
  console.log('🐘 [Database Mode]: Đang chạy ở chế độ PostgreSQL 16 (Docker Local)');
  module.exports = require('./pgAdapter.cjs');
}
