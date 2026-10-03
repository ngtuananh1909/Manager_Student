'use strict';

const crypto = require('crypto');
const { query, transaction } = require('../pool.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Lấy danh sách toàn bộ các kỳ thi kèm bài tập và target
 */
async function getContests() {
  const sql = `
    SELECT 
      c.id, c.title, c.description, c.mode, c.scope_type AS "scopeType",
      c.total_score AS "totalScore", c.memory_limit AS "memoryLimit", c.category,
      c.start_time AS "startTime", c.end_time AS "endTime", c.duration_minutes AS "durationMinutes",
      c.status, c.grading_mode AS "gradingMode", c.freeze_scoreboard_minutes AS "freezeScoreboardMinutes",
      c.pin_code AS "pinCode", c.hide_test_details_for_students AS "hideTestDetailsForStudents",
      c.require_freopen AS "requireFreopen", c.allow_reopen AS "allowReopen",
      c.io_mode AS "ioMode", c.scoring_mode AS "scoringMode", c.ip_whitelist AS "ipWhitelist",
      c.anti_cheat AS "antiCheat", c.pdf_url AS "pdfUrl", c.pdf_file_name AS "pdfFileName",
      c.statement_html AS "statementHtml", c.created_at AS "createdAt",
      COALESCE(
        array_agg(DISTINCT cp.problem_id) FILTER (WHERE cp.problem_id IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS "problemIds",
      COALESCE(
        array_agg(DISTINCT ct.target_id) FILTER (WHERE ct.target_type = 'CLASS'),
        ARRAY[]::VARCHAR[]
      ) AS "targetClasses",
      COALESCE(
        array_agg(DISTINCT ct.target_id) FILTER (WHERE ct.target_type = 'STUDENT'),
        ARRAY[]::VARCHAR[]
      ) AS "targetStudents",
      COALESCE(
        array_agg(DISTINCT ct.target_id::INT) FILTER (WHERE ct.target_type = 'GRADE'),
        ARRAY[]::INT[]
      ) AS "targetGrades"
    FROM contests c
    LEFT JOIN contest_problems cp ON cp.contest_id = c.id
    LEFT JOIN contest_targets ct ON ct.contest_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;
  const res = await query(sql);
  return res.rows.map(row => ({
    ...row,
    classIds: row.targetClasses,
    candidateIds: row.targetStudents
  }));
}

/**
 * Lấy chi tiết một kỳ thi theo ID
 */
async function getContest(id) {
  if (!id) return null;
  const sql = `
    SELECT 
      c.id, c.title, c.description, c.mode, c.scope_type AS "scopeType",
      c.total_score AS "totalScore", c.memory_limit AS "memoryLimit", c.category,
      c.start_time AS "startTime", c.end_time AS "endTime", c.duration_minutes AS "durationMinutes",
      c.status, c.grading_mode AS "gradingMode", c.freeze_scoreboard_minutes AS "freezeScoreboardMinutes",
      c.pin_code AS "pinCode", c.hide_test_details_for_students AS "hideTestDetailsForStudents",
      c.require_freopen AS "requireFreopen", c.allow_reopen AS "allowReopen",
      c.io_mode AS "ioMode", c.scoring_mode AS "scoringMode", c.ip_whitelist AS "ipWhitelist",
      c.anti_cheat AS "antiCheat", c.pdf_url AS "pdfUrl", c.pdf_file_name AS "pdfFileName",
      c.statement_html AS "statementHtml", c.created_at AS "createdAt",
      COALESCE(
        array_agg(DISTINCT cp.problem_id) FILTER (WHERE cp.problem_id IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS "problemIds",
      COALESCE(
        array_agg(DISTINCT ct.target_id) FILTER (WHERE ct.target_type = 'CLASS'),
        ARRAY[]::VARCHAR[]
      ) AS "targetClasses",
      COALESCE(
        array_agg(DISTINCT ct.target_id) FILTER (WHERE ct.target_type = 'STUDENT'),
        ARRAY[]::VARCHAR[]
      ) AS "targetStudents",
      COALESCE(
        array_agg(DISTINCT ct.target_id::INT) FILTER (WHERE ct.target_type = 'GRADE'),
        ARRAY[]::INT[]
      ) AS "targetGrades"
    FROM contests c
    LEFT JOIN contest_problems cp ON cp.contest_id = c.id
    LEFT JOIN contest_targets ct ON ct.contest_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `;
  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    classIds: row.targetClasses,
    candidateIds: row.targetStudents
  };
}

/**
 * Tạo kỳ thi mới
 */
async function createContest(contest) {
  const id = contest.id || newId('cnt');
  const title = String(contest.title || '').trim();
  const description = String(contest.description || '');
  const mode = contest.mode || 'offline';
  const totalScore = Number(contest.totalScore) || 100;
  const memoryLimit = Math.min(5120, Math.max(16, Number(contest.memoryLimit) || 256));
  const category = contest.category || 'regular';
  const startTime = contest.startTime || new Date().toISOString();
  const endTime = contest.endTime || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const durationMinutes = Number(contest.durationMinutes) || 45;
  const status = contest.status || 'running';
  const gradingMode = contest.gradingMode || 'direct';
  const freezeScoreboardMinutes = Number(contest.freezeScoreboardMinutes) || 15;
  const pinCode = contest.pinCode ? String(contest.pinCode).trim() : '';
  const hideTestDetailsForStudents = contest.hideTestDetailsForStudents !== false;
  const requireFreopen = !!contest.requireFreopen;
  const allowReopen = contest.allowReopen !== false;
  const ioMode = contest.ioMode || (requireFreopen ? 'freopen' : 'stdin');
  const scoringMode = ['LIVE_BEST', 'OLYMPIC_LATEST', 'PRETEST'].includes(contest.scoringMode) ? contest.scoringMode : 'LIVE_BEST';
  const ipWhitelist = String(contest.ipWhitelist || '').trim();
  const antiCheat = contest.antiCheat || { preventTabSwitch: true, maxTabViolations: 3, preventCopyPaste: false };
  const pdfUrl = contest.pdfUrl || '';
  const pdfFileName = contest.pdfFileName || '';
  const statementHtml = contest.statementHtml || '';

  const targetClasses = Array.isArray(contest.targetClasses) 
    ? contest.targetClasses 
    : (Array.isArray(contest.classIds) ? contest.classIds : []);
  const targetStudents = Array.isArray(contest.targetStudents) 
    ? contest.targetStudents 
    : (Array.isArray(contest.candidateIds) ? contest.candidateIds : []);
  const targetGrades = Array.isArray(contest.targetGrades) 
    ? contest.targetGrades.map(Number) 
    : [];

  let scopeType = contest.scopeType || 'ALL';
  if (!contest.scopeType) {
    if (targetStudents.length > 0) scopeType = 'STUDENT';
    else if (targetGrades.length > 0) scopeType = 'GRADE';
    else if (targetClasses.length > 0) scopeType = 'CLASS';
    else scopeType = 'ALL';
  }

  const problemIds = Array.isArray(contest.problemIds) ? contest.problemIds : [];

  return await transaction(async (client) => {
    const insertContestSql = `
      INSERT INTO contests (
        id, title, description, mode, scope_type, total_score, memory_limit,
        category, start_time, end_time, duration_minutes, status, grading_mode,
        freeze_scoreboard_minutes, pin_code, hide_test_details_for_students,
        require_freopen, allow_reopen, io_mode, scoring_mode, ip_whitelist,
        anti_cheat, pdf_url, pdf_file_name, statement_html
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING id, title, description, mode, scope_type AS "scopeType", total_score AS "totalScore",
                memory_limit AS "memoryLimit", category, start_time AS "startTime", end_time AS "endTime",
                duration_minutes AS "durationMinutes", status, grading_mode AS "gradingMode",
                freeze_scoreboard_minutes AS "freezeScoreboardMinutes", pin_code AS "pinCode",
                hide_test_details_for_students AS "hideTestDetailsForStudents", require_freopen AS "requireFreopen",
                allow_reopen AS "allowReopen", io_mode AS "ioMode", scoring_mode AS "scoringMode",
                ip_whitelist AS "ipWhitelist", anti_cheat AS "antiCheat", pdf_url AS "pdfUrl",
                pdf_file_name AS "pdfFileName", statement_html AS "statementHtml", created_at AS "createdAt"
    `;

    const res = await client.query(insertContestSql, [
      id, title, description, mode, scopeType, totalScore, memoryLimit,
      category, startTime, endTime, durationMinutes, status, gradingMode,
      freezeScoreboardMinutes, pinCode, hideTestDetailsForStudents,
      requireFreopen, allowReopen, ioMode, scoringMode, ipWhitelist,
      JSON.stringify(antiCheat), pdfUrl, pdfFileName, statementHtml
    ]);
    const created = res.rows[0];

    // Ghi các bài tập vào contest_problems
    for (let i = 0; i < problemIds.length; i++) {
      await client.query(`
        INSERT INTO contest_problems (contest_id, problem_id, order_index, score_weight)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [id, problemIds[i], i + 1, 100]);
    }

    // Ghi các targets vào contest_targets
    for (const cId of targetClasses) {
      await client.query(`
        INSERT INTO contest_targets (contest_id, target_type, target_id)
        VALUES ($1, 'CLASS', $2)
      `, [id, cId]);
    }
    for (const sId of targetStudents) {
      await client.query(`
        INSERT INTO contest_targets (contest_id, target_type, target_id)
        VALUES ($1, 'STUDENT', $2)
      `, [id, sId]);
    }
    for (const g of targetGrades) {
      await client.query(`
        INSERT INTO contest_targets (contest_id, target_type, target_id)
        VALUES ($1, 'GRADE', $2)
      `, [id, String(g)]);
    }

    created.problemIds = problemIds;
    created.targetClasses = targetClasses;
    created.targetStudents = targetStudents;
    created.targetGrades = targetGrades;
    created.classIds = targetClasses;
    created.candidateIds = targetStudents;
    return created;
  });
}

/**
 * Cập nhật kỳ thi
 */
async function updateContest(id, updates = {}) {
  const current = await getContest(id);
  if (!current) return null;

  return await transaction(async (client) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(String(updates.title).trim());
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(String(updates.description));
    }
    if (updates.scopeType !== undefined) {
      fields.push(`scope_type = $${idx++}`);
      values.push(updates.scopeType);
    }
    if (updates.totalScore !== undefined) {
      fields.push(`total_score = $${idx++}`);
      values.push(Number(updates.totalScore));
    }
    if (updates.memoryLimit !== undefined) {
      fields.push(`memory_limit = $${idx++}`);
      values.push(Math.min(5120, Math.max(16, Number(updates.memoryLimit) || 256)));
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.startTime !== undefined) {
      fields.push(`start_time = $${idx++}`);
      values.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      fields.push(`end_time = $${idx++}`);
      values.push(updates.endTime);
    }
    if (updates.durationMinutes !== undefined) {
      fields.push(`duration_minutes = $${idx++}`);
      values.push(Number(updates.durationMinutes));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.gradingMode !== undefined) {
      fields.push(`grading_mode = $${idx++}`);
      values.push(updates.gradingMode);
    }
    if (updates.freezeScoreboardMinutes !== undefined) {
      fields.push(`freeze_scoreboard_minutes = $${idx++}`);
      values.push(Number(updates.freezeScoreboardMinutes));
    }
    if (updates.pinCode !== undefined) {
      fields.push(`pin_code = $${idx++}`);
      values.push(String(updates.pinCode).trim());
    }
    if (updates.hideTestDetailsForStudents !== undefined) {
      fields.push(`hide_test_details_for_students = $${idx++}`);
      values.push(!!updates.hideTestDetailsForStudents);
    }
    if (updates.requireFreopen !== undefined) {
      fields.push(`require_freopen = $${idx++}`);
      values.push(!!updates.requireFreopen);
    }
    if (updates.allowReopen !== undefined) {
      fields.push(`allow_reopen = $${idx++}`);
      values.push(updates.allowReopen !== false);
    }
    if (updates.ioMode !== undefined) {
      fields.push(`io_mode = $${idx++}`);
      values.push(updates.ioMode);
    }
    if (updates.scoringMode !== undefined) {
      fields.push(`scoring_mode = $${idx++}`);
      values.push(updates.scoringMode);
    }
    if (updates.antiCheat !== undefined) {
      fields.push(`anti_cheat = $${idx++}`);
      values.push(JSON.stringify(updates.antiCheat));
    }

    if (fields.length > 0) {
      values.push(id);
      await client.query(`UPDATE contests SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    // Cập nhật problemIds
    if (Array.isArray(updates.problemIds)) {
      await client.query('DELETE FROM contest_problems WHERE contest_id = $1', [id]);
      for (let i = 0; i < updates.problemIds.length; i++) {
        await client.query(`
          INSERT INTO contest_problems (contest_id, problem_id, order_index, score_weight)
          VALUES ($1, $2, $3, 100)
          ON CONFLICT DO NOTHING
        `, [id, updates.problemIds[i], i + 1]);
      }
    }

    // Cập nhật targets
    const targetClasses = updates.targetClasses || updates.classIds;
    const targetStudents = updates.targetStudents || updates.candidateIds;
    const targetGrades = updates.targetGrades;

    if (targetClasses !== undefined || targetStudents !== undefined || targetGrades !== undefined) {
      await client.query('DELETE FROM contest_targets WHERE contest_id = $1', [id]);

      const classesToInsert = targetClasses !== undefined ? targetClasses : current.targetClasses;
      const studentsToInsert = targetStudents !== undefined ? targetStudents : current.targetStudents;
      const gradesToInsert = targetGrades !== undefined ? targetGrades : current.targetGrades;

      for (const cId of classesToInsert) {
        await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'CLASS', $2)", [id, cId]);
      }
      for (const sId of studentsToInsert) {
        await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'STUDENT', $2)", [id, sId]);
      }
      for (const g of gradesToInsert) {
        await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'GRADE', $2)", [id, String(g)]);
      }
    }

    return await getContest(id);
  });
}

/**
 * Xóa kỳ thi
 */
async function deleteContest(id) {
  const res = await query('DELETE FROM contests WHERE id = $1 RETURNING id', [id]);
  return res.rows.length > 0;
}

/**
 * Kiểm tra học sinh có đủ điều kiện tham gia kỳ thi không (Tuân thủ triệt để AGENTS.md rules 27-41)
 */
async function isStudentEligible(student, contest) {
  if (!student || !contest) return false;
  if (student.role === 'host') return true;

  const scopeType = (contest.scopeType || 'ALL').toUpperCase();

  // Kiểm tra bằng SQL trực tiếp
  const sql = `
    SELECT 1 FROM contests c
    WHERE c.id = $1
      AND (
        c.scope_type = 'ALL'
        OR (c.scope_type = 'CLASS' AND EXISTS (
          SELECT 1 FROM student_enrollments se
          JOIN contest_targets ct ON ct.contest_id = c.id AND ct.target_type = 'CLASS'
          WHERE se.student_id = $2 AND se.class_id = ct.target_id
        ))
        OR (c.scope_type = 'GRADE' AND EXISTS (
          SELECT 1 FROM student_enrollments se
          JOIN classes cls ON cls.id = se.class_id
          JOIN contest_targets ct ON ct.contest_id = c.id AND ct.target_type = 'GRADE'
          WHERE se.student_id = $2 AND (
            cls.grade = ct.target_id::INT
            OR substring(cls.name from '\\d+')::INT = ct.target_id::INT
          )
        ))
        OR (c.scope_type = 'STUDENT' AND EXISTS (
          SELECT 1 FROM contest_targets ct
          WHERE ct.contest_id = c.id AND ct.target_type = 'STUDENT' AND ct.target_id = $2
        ))
      )
  `;
  const res = await query(sql, [contest.id, student.id]);
  return res.rows.length > 0;
}

/**
 * Lấy danh sách điểm danh phòng thi của một kỳ thi
 */
async function getContestAttendance(contestId) {
  const sql = `
    SELECT contest_id AS "contestId", user_id AS "userId", status,
           extra_minutes AS "extraMinutes", reopened, joined_at AS "joinedAt"
    FROM contest_attendance
    WHERE contest_id = $1
  `;
  const res = await query(sql, [contestId]);
  const map = {};
  for (const row of res.rows) {
    map[row.userId] = row;
  }
  return map;
}

/**
 * Ghi nhận học sinh tham gia phòng thi
 */
async function recordAttendance(contestId, userId, extraMinutes = 0) {
  const sql = `
    INSERT INTO contest_attendance (contest_id, user_id, status, extra_minutes)
    VALUES ($1, $2, 'active', $3)
    ON CONFLICT (contest_id, user_id) 
    DO UPDATE SET status = 'active', extra_minutes = EXCLUDED.extra_minutes
    RETURNING contest_id AS "contestId", user_id AS "userId", status,
              extra_minutes AS "extraMinutes", reopened, joined_at AS "joinedAt"
  `;
  const res = await query(sql, [contestId, userId, extraMinutes]);
  return res.rows[0];
}

/**
 * Mở lại bài thi cho một học sinh sau khi hết giờ
 */
async function reopenContestForStudent(contestId, userId) {
  const sql = `
    UPDATE contest_attendance
    SET reopened = true, status = 'active'
    WHERE contest_id = $1 AND user_id = $2
    RETURNING contest_id AS "contestId", user_id AS "userId", status, reopened
  `;
  const res = await query(sql, [contestId, userId]);
  return res.rows[0] || null;
}

module.exports = {
  getContests,
  getContest,
  createContest,
  updateContest,
  deleteContest,
  isStudentEligible,
  getContestAttendance,
  recordAttendance,
  reopenContestForStudent
};
