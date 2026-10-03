'use strict';

const { pool, query, testConnection } = require('./pool.cjs');

const EXPECTED_TABLES = [
  'classes',
  'users',
  'student_enrollments',
  'problems',
  'test_cases',
  'contests',
  'contest_targets',
  'contest_problems',
  'submissions',
  'submission_details',
  'contest_attendance',
  'virtual_sessions',
  'achievements',
  'student_achievements',
  'rewards',
  'reward_redemptions',
  'settings'
];

async function verify() {
  console.log('🔍 [Database Verifier] Bắt đầu kiểm tra trạng thái CSDL PostgreSQL...');

  const conn = await testConnection();
  if (!conn.ok) {
    console.error('❌ Không thể kết nối tới PostgreSQL:', conn.error);
    process.exit(1);
  }

  console.log(`✅ Kết nối thành công! Phiên bản: ${conn.version.split(' ')[0]} ${conn.version.split(' ')[1]}`);

  // Lấy danh sách các bảng trong schema public
  const tableRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);
  const existingTables = new Set(tableRes.rows.map(r => r.table_name));

  console.log('\n📊 ================= BẢNG KIỂM TRA SCHEMA =================');
  let missingCount = 0;

  for (const table of EXPECTED_TABLES) {
    if (existingTables.has(table)) {
      const countRes = await query(`SELECT COUNT(*) AS count FROM "${table}"`);
      const rowCount = countRes.rows[0].count;
      console.log(`✅ [OK] Bảng "${table.padEnd(22)}": ${String(rowCount).padStart(5)} bản ghi`);
    } else {
      console.log(`❌ [THIẾU] Bảng "${table.padEnd(22)}" CHƯA ĐƯỢC TẠO!`);
      missingCount++;
    }
  }

  console.log('==========================================================\n');

  if (missingCount === 0) {
    console.log('🎉 Toàn bộ schema cơ sở dữ liệu đã sẵn sàng và hợp lệ 100%!');
  } else {
    console.warn(`⚠️ Phát hiện ${missingCount} bảng còn thiếu. Hãy chạy: node server/database/migrate-from-json.cjs`);
  }
}

if (require.main === module) {
  verify()
    .then(() => pool.end())
    .catch((err) => {
      console.error('❌ Lỗi kiểm tra:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { verify };
