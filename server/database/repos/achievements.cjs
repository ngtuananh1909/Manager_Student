'use strict';

const crypto = require('crypto');
const { query } = require('../pool.cjs');
const { DEFAULT_ACHIEVEMENTS, DEFAULT_REWARDS } = require('../../achievementsData.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Lấy danh sách toàn bộ huy hiệu / danh hiệu
 */
async function getAchievements() {
  const sql = `
    SELECT id, code, title, description, icon, category, points
    FROM achievements
    ORDER BY points ASC
  `;
  const res = await query(sql);
  if (res.rows.length === 0) {
    return DEFAULT_ACHIEVEMENTS.map(a => ({
      id: a.id,
      code: a.code,
      title: a.name || a.title,
      description: a.description,
      icon: a.icon,
      category: a.category,
      points: a.points
    }));
  }
  return res.rows;
}

/**
 * Lấy danh sách huy hiệu đã mở khóa của một học sinh
 */
async function getStudentAchievements(userId) {
  const sql = `
    SELECT a.id, a.code, a.title, a.description, a.icon, a.category, a.points,
           sa.unlocked_at AS "unlockedAt"
    FROM student_achievements sa
    JOIN achievements a ON a.id = sa.achievement_id
    WHERE sa.user_id = $1
    ORDER BY sa.unlocked_at DESC
  `;
  const res = await query(sql, [userId]);
  return res.rows;
}

/**
 * Trao huy hiệu cho học sinh
 */
async function awardAchievement(userId, achievementId) {
  const sql = `
    INSERT INTO student_achievements (user_id, achievement_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id, user_id AS "userId", achievement_id AS "achievementId", unlocked_at AS "unlockedAt"
  `;
  const res = await query(sql, [userId, achievementId]);
  return res.rows[0] || null;
}

/**
 * Lấy danh sách phần thưởng
 */
async function getRewards() {
  const sql = `
    SELECT id, name, description, points_cost AS "pointsCost", icon
    FROM rewards
    ORDER BY points_cost ASC
  `;
  const res = await query(sql);
  if (res.rows.length === 0) {
    return DEFAULT_REWARDS;
  }
  return res.rows;
}

/**
 * Đổi phần thưởng bằng điểm thưởng
 */
async function redeemReward(userId, rewardId) {
  const id = newId('rdm');
  const sql = `
    INSERT INTO reward_redemptions (id, user_id, reward_id)
    VALUES ($1, $2, $3)
    RETURNING id, user_id AS "userId", reward_id AS "rewardId", redeemed_at AS "redeemedAt"
  `;
  const res = await query(sql, [id, userId, rewardId]);
  return res.rows[0];
}

/**
 * Tự động kiểm tra và trao các danh hiệu cơ bản (First Blood, Speed Demon,...)
 */
async function checkAndAwardAchievements(userId) {
  const awarded = [];
  // Lấy danh sách submissions của user
  const subRes = await query('SELECT * FROM submissions WHERE user_id = $1', [userId]);
  const subs = subRes.rows;

  const totalSubs = subs.length;
  const acSubs = subs.filter(s => s.status === 'AC');

  // Kiểm tra lần nộp đầu tiên
  if (totalSubs >= 1) {
    const ach = await awardAchievement(userId, 'ACH_BEG_01');
    if (ach) awarded.push(ach);
  }
  // Kiểm tra AC đầu tiên
  if (acSubs.length >= 1) {
    const ach = await awardAchievement(userId, 'ACH_BEG_02');
    if (ach) awarded.push(ach);
  }
  // Giải được 3 bài
  const distinctAC = new Set(acSubs.map(s => s.problem_id));
  if (distinctAC.size >= 3) {
    const ach = await awardAchievement(userId, 'ACH_BEG_03');
    if (ach) awarded.push(ach);
  }
  // Giải được 5 bài
  if (distinctAC.size >= 5) {
    const ach = await awardAchievement(userId, 'ACH_BEG_04');
    if (ach) awarded.push(ach);
  }

  return awarded;
}

module.exports = {
  getAchievements,
  getStudentAchievements,
  awardAchievement,
  getRewards,
  redeemReward,
  checkAndAwardAchievements
};
