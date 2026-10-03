'use strict';

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../server/database/pool.cjs');
const problemsRepo = require('../server/database/repos/problems.cjs');

async function verifyStorageFlow() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 KIỂM CHỨNG THỰC TẾ: QUY TRÌNH LƯU TRỮ ĐỀ BÀI & TESTCASE (PHƯƠNG ÁN B HYBRID)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Giả lập nạp một bài tập mới kèm mô tả HTML và bộ testcase
  const demoCode = 'SUM_SERIES_' + Math.floor(Math.random() * 1000);
  const newProblemData = {
    code: demoCode,
    title: 'Tính Tổng Dãy Số Tự Nhiên',
    difficulty: 'Dễ',
    points: 100,
    timeLimit: 1000,
    memoryLimit: 256,
    category: 'C++11',
    description: 'Cho mảng số nguyên gồm N phần tử. Hãy tính tổng của dãy số đã cho.',
    statementHtml: `
      <h2>Yêu cầu bài toán</h2>
      <p>Cho dãy gồm <b>N</b> số nguyên \(A_1, A_2, \dots, A_N\). Hãy tính tổng các phần tử trong dãy.</p>
      <h3>Dữ liệu vào:</h3>
      <ul>
        <li>Dòng 1: Số nguyên dương N</li>
        <li>Dòng 2: N số nguyên cách nhau bởi dấu cách</li>
      </ul>
      <h3>Dữ liệu ra:</h3>
      <p>In ra một số nguyên duy nhất là tổng dãy số.</p>
    `.trim(),
    testCases: [
      {
        name: 'test01',
        input: '3\n1 2 3\n',
        expectedOutput: '6\n',
        score: 30,
        isSample: true,
        isTrap: false
      },
      {
        name: 'test02',
        input: '5\n10 20 30 40 50\n',
        expectedOutput: '150\n',
        score: 35,
        isSample: false,
        isTrap: false
      },
      {
        name: 'test03',
        input: '4\n-100 100 -25 25\n',
        expectedOutput: '0\n',
        score: 35,
        isSample: false,
        isTrap: true // Test bẫy số âm
      }
    ]
  };

  console.log(`▶ BƯỚC 1: Tạo bài tập "${newProblemData.title}" (Mã: ${demoCode})`);
  const createdProb = await problemsRepo.createProblem(newProblemData);
  console.log(`   ✅ Đã tạo thành công bài tập với ID: ${createdProb.id}\n`);

  // 2. Kiểm chứng tầng Ổ ĐĨA CỨNG (Filesystem: storage/testcases/<id>/)
  console.log('▶ BƯỚC 2: Kiểm chứng TẦNG Ổ ĐĨA (Filesystem)');
  const probStorageDir = path.join(process.cwd(), 'storage', 'testcases', createdProb.id);
  console.log(`   📁 Thư mục lưu testcase trên máy: ${probStorageDir}`);

  if (fs.existsSync(probStorageDir)) {
    const files = fs.readdirSync(probStorageDir).sort();
    console.log(`   📂 Danh sách ${files.length} file được sinh ra trên ổ cứng:`);
    for (const f of files) {
      const filePath = path.join(probStorageDir, f);
      const content = fs.readFileSync(filePath, 'utf8').trim();
      const stat = fs.statSync(filePath);
      console.log(`      ├── 📄 ${f.padEnd(14)} (${stat.size} bytes) -> Nội dung: "${content.replace(/\n/g, ' ')}"`);
    }
  } else {
    console.error('   ❌ LỖI: Thư mục không tồn tại trên ổ cứng!');
  }
  console.log('');

  // 3. Kiểm chứng tầng CƠ SỞ DỮ LIỆU DOCKER (PostgreSQL)
  console.log('▶ BƯỚC 3: Kiểm chứng TẦNG CƠ SỞ DỮ LIỆU (Docker PostgreSQL)');
  
  // 3.1 Truy vấn bảng problems
  const probSql = `
    SELECT id, code, title, points, time_limit, memory_limit, test_count, created_at
    FROM problems
    WHERE id = $1
  `;
  const probDbRes = await query(probSql, [createdProb.id]);
  console.log('   🐘 Dữ liệu trong bảng "problems" của PostgreSQL:');
  console.table(probDbRes.rows);

  // 3.2 Truy vấn bảng test_cases
  const tcSql = `
    SELECT test_index, name, score, is_sample, is_trap, input_path, output_path
    FROM test_cases
    WHERE problem_id = $1
    ORDER BY test_index ASC
  `;
  const tcDbRes = await query(tcSql, [createdProb.id]);
  console.log('   🐘 Dữ liệu trong bảng "test_cases" của PostgreSQL (Chỉ lưu đường dẫn, không lưu cả MB dữ liệu vào DB):');
  console.table(tcDbRes.rows);

  // 4. Kiểm chứng Judge Engine đọc lại dữ liệu từ đĩa
  console.log('▶ BƯỚC 4: Kiểm chứng Judge Engine nạp lại Testcases để chấm');
  const readBack = await problemsRepo.getProblemTestCases(createdProb.id);
  console.log(`   🎯 Judge Engine đọc thành công ${readBack.length} testcases từ ổ đĩa:`);
  readBack.forEach(tc => {
    console.log(`      * [${tc.name}] Điểm: ${tc.score} | Sample: ${tc.isSample} | Trap: ${tc.isTrap} | Input: "${tc.input.trim()}" ➔ Output: "${tc.expectedOutput.trim()}"`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🎉 TỔNG KẾT:');
  console.log('1. PostgreSQL lưu trữ toàn vẹn: Metadata, điểm số, cờ sample/trap, đường dẫn file.');
  console.log('2. Ổ đĩa lưu trữ an toàn: File .inp và .out nằm riêng biệt trong storage/testcases/');
  console.log('3. Bạn có thể mở ngay http://localhost:5000 để xem bài tập này trên Web UI pgweb!');
  console.log(`   (ID bài tập vừa tạo: ${createdProb.id})`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

if (require.main === module) {
  verifyStorageFlow()
    .then(() => pool.end())
    .catch(err => {
      console.error('❌ Lỗi:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = { verifyStorageFlow };
