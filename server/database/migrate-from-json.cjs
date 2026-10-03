'use strict';

const fs = require('fs');
const path = require('path');
const { pool, query, transaction } = require('./pool.cjs');
const { DEFAULT_ACHIEVEMENTS, DEFAULT_REWARDS } = require('../achievementsData.cjs');

function getDataDir() {
  if (process.env.SCHOOLJUDGE_DATA_DIR) {
    return path.resolve(process.env.SCHOOLJUDGE_DATA_DIR);
  }
  return process.cwd();
}

const DATA_DIR = getDataDir();
const DATA_FILE = path.join(DATA_DIR, 'schooljudge_data.json');
const TESTCASES_DIR = path.join(DATA_DIR, 'testcases');
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'testcases');

async function ensureSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const ddl = fs.readFileSync(schemaPath, 'utf8');
    await query(ddl);
    console.log('✅ Đã kiểm tra và khởi tạo schema bảng CSDL.');
  }
}

async function migrate() {
  console.log('🚀 Bắt đầu quá trình Migration từ JSON sang PostgreSQL...');
  console.log(`📁 Đường dẫn dữ liệu nguồn: ${DATA_FILE}`);

  if (!fs.existsSync(DATA_FILE)) {
    console.warn('⚠️ Không tìm thấy file schooljudge_data.json. Khởi tạo DB trống.');
    await ensureSchema();
    return;
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Lỗi cú pháp trong schooljudge_data.json:', err.message);
    return;
  }

  await ensureSchema();

  // Tạo thư mục storage
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  const stats = {
    classes: 0,
    users: 0,
    enrollments: 0,
    problems: 0,
    testcases: 0,
    contests: 0,
    submissions: 0,
    submissionDetails: 0
  };

  await transaction(async (client) => {
    // 1. Settings
    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) {
        await client.query(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [k, JSON.stringify(v)]);
      }
    }

    // 2. Classes
    if (Array.isArray(data.classes)) {
      for (const cls of data.classes) {
        await client.query(`
          INSERT INTO classes (id, name, grade, teacher, join_code)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, grade = EXCLUDED.grade
        `, [
          cls.id,
          cls.name,
          cls.grade !== undefined && cls.grade !== null ? Number(cls.grade) : null,
          cls.teacher || 'Giáo viên',
          cls.joinCode || cls.id
        ]);
        stats.classes++;
      }
    }

    // 3. Users & Enrollments
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        await client.query(`
          INSERT INTO users (id, username, password_hash, full_name, role, streak, is_locked, must_change_password)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET 
            full_name = EXCLUDED.full_name,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role
        `, [
          u.id,
          u.username.toLowerCase(),
          u.passwordHash || '',
          u.fullName || u.username,
          u.role || 'user',
          Number(u.streak) || 1,
          !!u.isLocked,
          !!u.mustChangePassword
        ]);
        stats.users++;

        // Enrollments
        const classes = Array.isArray(u.classes) && u.classes.length > 0
          ? u.classes
          : (u.classId ? [u.classId] : []);

        for (const cId of classes) {
          await client.query(`
            INSERT INTO student_enrollments (student_id, class_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [u.id, cId]);
          stats.enrollments++;
        }
      }
    }

    // 4. Problems & Testcases (Tách file ra storage/)
    if (Array.isArray(data.problems)) {
      for (const p of data.problems) {
        await client.query(`
          INSERT INTO problems (
            id, code, title, difficulty, points, time_limit, memory_limit,
            category, description, statement, statement_html, sample_code,
            pdf_url, pdf_file_name, samples, test_count
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            title = EXCLUDED.title,
            test_count = EXCLUDED.test_count
        `, [
          p.id,
          String(p.code || 'BAI').toUpperCase().trim(),
          String(p.title || p.code || 'Bài tập').trim(),
          p.difficulty || 'Trung bình',
          Number(p.points) || 100,
          Number(p.timeLimit) || 1000,
          Number(p.memoryLimit) || 256,
          p.category || 'C++11',
          p.description || '',
          p.statement || '',
          p.statementHtml || '',
          p.sampleCode || '',
          p.pdfUrl || '',
          p.pdfFileName || '',
          JSON.stringify(Array.isArray(p.samples) ? p.samples : []),
          p.testCount || 0
        ]);
        stats.problems++;

        // Tìm testcase từ file hoặc inline
        let tcs = [];
        const tcFile = path.join(TESTCASES_DIR, `${p.id}.json`);
        if (fs.existsSync(tcFile)) {
          try {
            tcs = JSON.parse(fs.readFileSync(tcFile, 'utf8'));
          } catch (e) {}
        } else if (Array.isArray(p.testCases) && p.testCases.length > 0) {
          tcs = p.testCases;
        }

        // Tách ra storage/testcases/<probId>/
        if (Array.isArray(tcs) && tcs.length > 0) {
          const probDir = path.join(STORAGE_DIR, p.id);
          if (!fs.existsSync(probDir)) fs.mkdirSync(probDir, { recursive: true });

          await client.query('DELETE FROM test_cases WHERE problem_id = $1', [p.id]);

          for (let i = 0; i < tcs.length; i++) {
            const tc = tcs[i];
            const testIdx = i + 1;
            const tcName = tc.name || `test${String(testIdx).padStart(2, '0')}`;
            const tcId = tc.id || `${p.id}-tc-${testIdx}`;

            const inAbsPath = path.join(probDir, `${tcName}.inp`);
            const outAbsPath = path.join(probDir, `${tcName}.out`);
            fs.writeFileSync(inAbsPath, tc.input || '', 'utf8');
            fs.writeFileSync(outAbsPath, tc.expectedOutput || '', 'utf8');

            const inRelPath = path.relative(process.cwd(), inAbsPath);
            const outRelPath = path.relative(process.cwd(), outAbsPath);

            await client.query(`
              INSERT INTO test_cases (id, problem_id, test_index, name, score, is_sample, is_trap, input_path, output_path)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO NOTHING
            `, [
              tcId, p.id, testIdx, tcName,
              Number(tc.score) || 0, !!tc.isSample, !!tc.isTrap,
              inRelPath, outRelPath
            ]);
            stats.testcases++;
          }
          await client.query('UPDATE problems SET test_count = $1 WHERE id = $2', [tcs.length, p.id]);
        }
      }
    }

    // 5. Contests & Targets
    if (Array.isArray(data.contests)) {
      for (const c of data.contests) {
        await client.query(`
          INSERT INTO contests (
            id, title, description, mode, scope_type, total_score, memory_limit,
            category, start_time, end_time, duration_minutes, status, grading_mode,
            freeze_scoreboard_minutes, pin_code, hide_test_details_for_students,
            require_freopen, allow_reopen, io_mode, scoring_mode, ip_whitelist,
            anti_cheat, pdf_url, pdf_file_name, statement_html
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status
        `, [
          c.id, c.title || '', c.description || '', c.mode || 'offline', c.scopeType || 'ALL',
          Number(c.totalScore) || 100, Number(c.memoryLimit) || 256, c.category || 'regular',
          c.startTime || new Date().toISOString(), c.endTime || new Date(Date.now() + 3600000).toISOString(),
          Number(c.durationMinutes) || 45, c.status || 'running', c.gradingMode || 'direct',
          Number(c.freezeScoreboardMinutes) || 15, c.pinCode || '', c.hideTestDetailsForStudents !== false,
          !!c.requireFreopen, c.allowReopen !== false, c.ioMode || 'stdin', c.scoringMode || 'LIVE_BEST',
          c.ipWhitelist || '', JSON.stringify(c.antiCheat || {}), c.pdfUrl || '', c.pdfFileName || '', c.statementHtml || ''
        ]);
        stats.contests++;

        // Contest Problems
        if (Array.isArray(c.problemIds)) {
          for (let i = 0; i < c.problemIds.length; i++) {
            await client.query(`
              INSERT INTO contest_problems (contest_id, problem_id, order_index, score_weight)
              VALUES ($1, $2, $3, 100)
              ON CONFLICT DO NOTHING
            `, [c.id, c.problemIds[i], i + 1]);
          }
        }

        // Contest Targets
        const classes = c.targetClasses || c.classIds || [];
        for (const cId of classes) {
          await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'CLASS', $2)", [c.id, cId]);
        }
        const students = c.targetStudents || c.candidateIds || [];
        for (const sId of students) {
          await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'STUDENT', $2)", [c.id, sId]);
        }
        const grades = c.targetGrades || [];
        for (const g of grades) {
          await client.query("INSERT INTO contest_targets (contest_id, target_type, target_id) VALUES ($1, 'GRADE', $2)", [c.id, String(g)]);
        }
      }
    }

    // 6. Submissions & Details
    if (Array.isArray(data.submissions)) {
      for (const s of data.submissions) {
        await client.query(`
          INSERT INTO submissions (
            id, user_id, problem_id, contest_id, code, status, score,
            passed_tests, total_tests, execution_time, memory_used, compile_error,
            is_virtual, participation_type, virtual_session_id, submitted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING
        `, [
          s.id, s.userId, s.problemId, s.contestId || null, s.code || '', s.status || 'QUEUED',
          Number(s.score) || 0, Number(s.passedTests) || 0, Number(s.totalTests) || 0,
          Number(s.executionTime) || 0, Number(s.memoryUsed) || 0, s.compileError || null,
          !!s.isVirtual, s.participationType || 'REAL', s.virtualSessionId || null,
          s.submittedAt || new Date().toISOString()
        ]);
        stats.submissions++;

        if (Array.isArray(s.details)) {
          for (const d of s.details) {
            await client.query(`
              INSERT INTO submission_details (submission_id, test_index, name, status, time, memory, score_earned, error_message)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              s.id, d.testIndex, d.name || `test${d.testIndex}`, d.status,
              Number(d.time) || 0, Number(d.memory) || 0, Number(d.scoreEarned) || 0, d.message || null
            ]);
            stats.submissionDetails++;
          }
        }
      }
    }

    // 7. Seed default achievements & rewards nếu chưa có
    for (const a of DEFAULT_ACHIEVEMENTS) {
      await client.query(`
        INSERT INTO achievements (id, code, title, description, icon, category, points)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [a.id, a.code, a.name || a.title, a.description, a.icon, a.category, a.points]);
    }

    for (const r of DEFAULT_REWARDS) {
      await client.query(`
        INSERT INTO rewards (id, name, description, points_cost, icon)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [r.id, r.name, r.description, r.pointsCost || 100, r.icon]);
    }
  });

  console.log('\n🎉 ================= MIGRATION REPORT =================');
  console.log(`✅ Lớp học (Classes):               ${stats.classes}`);
  console.log(`✅ Tài khoản người dùng (Users):     ${stats.users}`);
  console.log(`✅ Ghi danh lớp học (Enrollments):   ${stats.enrollments}`);
  console.log(`✅ Bài tập (Problems):               ${stats.problems}`);
  console.log(`✅ Testcases (Tách ra storage/):     ${stats.testcases}`);
  console.log(`✅ Kỳ thi (Contests):                ${stats.contests}`);
  console.log(`✅ Lịch sử bài nộp (Submissions):    ${stats.submissions}`);
  console.log(`✅ Chi tiết bài nộp (Sub Details):   ${stats.submissionDetails}`);
  console.log('========================================================\n');
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Hoàn tất migration thành công.');
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi trong quá trình migration:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { migrate };
