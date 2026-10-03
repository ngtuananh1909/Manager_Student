'use strict';

const { query } = require('../pool.cjs');

const DEFAULT_SETTINGS = {
  serverName: "ChauCaoJudge LAN - Máy Chủ Chấm Bài C++",
  port: 4000,
  compilerPath: "g++",
  useDocker: true,
  dockerImage: "gcc:13-bookworm",
  globalMemoryLimit: 256,
  contestMode: false,
  contestEndTime: null,
  freezeScoreboard: false,
  allowCustomRun: true,
  submissionMode: 'direct',
  submissionsClosed: false
};

/**
 * Lấy toàn bộ cài đặt hệ thống (ghép từ bảng settings hoặc giá trị mặc định)
 */
async function getSettings() {
  const sql = 'SELECT key, value FROM settings';
  const res = await query(sql);
  const current = { ...DEFAULT_SETTINGS };

  for (const row of res.rows) {
    current[row.key] = row.value;
  }
  return current;
}

/**
 * Cập nhật cấu hình hệ thống
 */
async function updateSettings(newSettings = {}) {
  for (const [key, value] of Object.entries(newSettings)) {
    await query(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [key, JSON.stringify(value)]);
  }
  return await getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS
};
