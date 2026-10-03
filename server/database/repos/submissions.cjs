'use strict';

const crypto = require('crypto');
const { query, transaction } = require('../pool.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Lấy danh sách bài nộp theo bộ lọc
 */
async function getSubmissions(filter = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filter.userId) {
    conditions.push(`s.user_id = $${idx++}`);
    values.push(filter.userId);
  }
  if (filter.problemId) {
    conditions.push(`s.problem_id = $${idx++}`);
    values.push(filter.problemId);
  }
  if (filter.contestId) {
    conditions.push(`s.contest_id = $${idx++}`);
    values.push(filter.contestId);
  }
  if (filter.virtualSessionId) {
    conditions.push(`s.virtual_session_id = $${idx++}`);
    values.push(filter.virtualSessionId);
  }
  if (filter.isVirtual !== undefined) {
    const isVirt = filter.isVirtual === 'true' || filter.isVirtual === true;
    conditions.push(`s.is_virtual = $${idx++}`);
    values.push(isVirt);
  }
  if (filter.participationType) {
    const pType = String(filter.participationType).toUpperCase();
    if (pType === 'REAL') {
      conditions.push(`(s.is_virtual = false AND s.participation_type != 'VIRTUAL')`);
    } else if (pType === 'VIRTUAL') {
      conditions.push(`(s.is_virtual = true OR s.participation_type = 'VIRTUAL')`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      s.id, s.user_id AS "userId", s.problem_id AS "problemId", s.contest_id AS "contestId",
      s.code, s.status, s.score, s.passed_tests AS "passedTests", s.total_tests AS "totalTests",
      s.execution_time AS "executionTime", s.memory_used AS "memoryUsed", s.compile_error AS "compileError",
      s.is_virtual AS "isVirtual", s.participation_type AS "participationType",
      s.virtual_session_id AS "virtualSessionId", s.submitted_at AS "submittedAt",
      u.full_name AS "userName", u.username,
      p.code AS "problemCode", p.title AS "problemTitle"
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN problems p ON p.id = s.problem_id
    ${whereClause}
    ORDER BY s.submitted_at DESC
  `;

  const res = await query(sql, values);
  return res.rows.map(row => ({
    ...row,
    score: Number(row.score),
    executionTime: Number(row.executionTime),
    memoryUsed: Number(row.memoryUsed)
  }));
}

/**
 * Lấy chi tiết một bài nộp kèm theo chi tiết từng test
 */
async function getSubmission(id) {
  if (!id) return null;
  const sql = `
    SELECT 
      s.id, s.user_id AS "userId", s.problem_id AS "problemId", s.contest_id AS "contestId",
      s.code, s.status, s.score, s.passed_tests AS "passedTests", s.total_tests AS "totalTests",
      s.execution_time AS "executionTime", s.memory_used AS "memoryUsed", s.compile_error AS "compileError",
      s.is_virtual AS "isVirtual", s.participation_type AS "participationType",
      s.virtual_session_id AS "virtualSessionId", s.submitted_at AS "submittedAt",
      u.full_name AS "userName", u.username,
      p.code AS "problemCode", p.title AS "problemTitle"
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN problems p ON p.id = s.problem_id
    WHERE s.id = $1
  `;
  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;
  const sub = res.rows[0];

  // Lấy chi tiết từng testcase
  const detailsSql = `
    SELECT 
      test_index AS "testIndex", name, status, time, memory,
      score_earned AS "scoreEarned", error_message AS "message"
    FROM submission_details
    WHERE submission_id = $1
    ORDER BY test_index ASC
  `;
  const detRes = await query(detailsSql, [id]);
  sub.details = detRes.rows.map(d => ({
    ...d,
    time: Number(d.time),
    memory: Number(d.memory),
    scoreEarned: Number(d.scoreEarned)
  }));

  sub.score = Number(sub.score);
  sub.executionTime = Number(sub.executionTime);
  sub.memoryUsed = Number(sub.memoryUsed);
  return sub;
}

/**
 * Tạo bài nộp mới (ban đầu có status QUEUED)
 */
async function createSubmission(sub) {
  const id = sub.id || newId('sub');
  const userId = sub.userId;
  const problemId = sub.problemId;
  const contestId = sub.contestId || null;
  const code = sub.code || '';
  const status = sub.status || 'QUEUED';
  const isVirtual = !!sub.isVirtual;
  const participationType = sub.participationType || (isVirtual ? 'VIRTUAL' : 'REAL');
  const virtualSessionId = sub.virtualSessionId || null;

  const sql = `
    INSERT INTO submissions (
      id, user_id, problem_id, contest_id, code, status,
      is_virtual, participation_type, virtual_session_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, user_id AS "userId", problem_id AS "problemId", contest_id AS "contestId",
              code, status, score, passed_tests AS "passedTests", total_tests AS "totalTests",
              execution_time AS "executionTime", memory_used AS "memoryUsed", compile_error AS "compileError",
              is_virtual AS "isVirtual", participation_type AS "participationType",
              virtual_session_id AS "virtualSessionId", submitted_at AS "submittedAt"
  `;
  const res = await query(sql, [
    id, userId, problemId, contestId, code, status, isVirtual, participationType, virtualSessionId
  ]);
  const created = res.rows[0];
  created.details = [];
  return created;
}

/**
 * Cập nhật kết quả chấm bài của một submission
 */
async function updateSubmission(id, updates = {}) {
  return await transaction(async (client) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.score !== undefined) {
      fields.push(`score = $${idx++}`);
      values.push(Number(updates.score));
    }
    if (updates.passedTests !== undefined) {
      fields.push(`passed_tests = $${idx++}`);
      values.push(Number(updates.passedTests));
    }
    if (updates.totalTests !== undefined) {
      fields.push(`total_tests = $${idx++}`);
      values.push(Number(updates.totalTests));
    }
    if (updates.executionTime !== undefined) {
      fields.push(`execution_time = $${idx++}`);
      values.push(Number(updates.executionTime));
    }
    if (updates.memoryUsed !== undefined) {
      fields.push(`memory_used = $${idx++}`);
      values.push(Number(updates.memoryUsed));
    }
    if (updates.compileError !== undefined) {
      fields.push(`compile_error = $${idx++}`);
      values.push(updates.compileError);
    }

    if (fields.length > 0) {
      values.push(id);
      await client.query(`UPDATE submissions SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    // Nếu có chi tiết từng testcase (details)
    if (Array.isArray(updates.details)) {
      await client.query('DELETE FROM submission_details WHERE submission_id = $1', [id]);
      for (const d of updates.details) {
        await client.query(`
          INSERT INTO submission_details (submission_id, test_index, name, status, time, memory, score_earned, error_message)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          d.testIndex,
          d.name || `test${d.testIndex}`,
          d.status || 'WA',
          Number(d.time) || 0,
          Number(d.memory) || 0,
          Number(d.scoreEarned) || 0,
          d.message || null
        ]);
      }
    }

    return await getSubmission(id);
  });
}

/**
 * Xóa một bài nộp
 */
async function deleteSubmission(id) {
  const res = await query('DELETE FROM submissions WHERE id = $1 RETURNING id', [id]);
  return res.rows.length > 0;
}

module.exports = {
  getSubmissions,
  getSubmission,
  createSubmission,
  updateSubmission,
  deleteSubmission
};
