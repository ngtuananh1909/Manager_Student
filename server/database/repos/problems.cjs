'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, transaction } = require('../pool.cjs');

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getStorageDir() {
  const dir = path.join(process.cwd(), 'storage', 'testcases');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Đọc nội dung toàn bộ testcases của một bài tập từ ổ đĩa
 */
async function getProblemTestCases(problemId) {
  if (!problemId) return [];
  const sql = `
    SELECT id, problem_id AS "problemId", test_index AS "testIndex",
           name, score, is_sample AS "isSample", is_trap AS "isTrap",
           input_path AS "inputPath", output_path AS "outputPath"
    FROM test_cases
    WHERE problem_id = $1
    ORDER BY test_index ASC
  `;
  const res = await query(sql, [problemId]);
  
  return res.rows.map(tc => {
    let input = '';
    let expectedOutput = '';
    try {
      const inPath = path.isAbsolute(tc.inputPath) ? tc.inputPath : path.join(process.cwd(), tc.inputPath);
      if (fs.existsSync(inPath)) input = fs.readFileSync(inPath, 'utf8');
    } catch (e) {}

    try {
      const outPath = path.isAbsolute(tc.outputPath) ? tc.outputPath : path.join(process.cwd(), tc.outputPath);
      if (fs.existsSync(outPath)) expectedOutput = fs.readFileSync(outPath, 'utf8');
    } catch (e) {}

    return {
      id: tc.id,
      name: tc.name,
      score: Number(tc.score),
      isSample: !!tc.isSample,
      isTrap: !!tc.isTrap,
      input,
      expectedOutput
    };
  });
}

/**
 * Lưu các testcases vào thư mục storage/testcases/<problemId>/ và cập nhật metadata vào bảng test_cases
 */
async function setProblemTestCases(problemId, testCases = []) {
  if (!problemId) return;
  const list = Array.isArray(testCases) ? testCases : [];
  const probStorageDir = path.join(getStorageDir(), problemId);
  if (!fs.existsSync(probStorageDir)) {
    fs.mkdirSync(probStorageDir, { recursive: true });
  }

  await transaction(async (client) => {
    // 1. Xóa metadata cũ trong bảng test_cases
    await client.query('DELETE FROM test_cases WHERE problem_id = $1', [problemId]);

    // 2. Ghi từng file và insert metadata
    for (let i = 0; i < list.length; i++) {
      const tc = list[i];
      const testIdx = i + 1;
      const tcId = tc.id || `${problemId}-tc-${testIdx}`;
      const tcName = tc.name || `test${String(testIdx).padStart(2, '0')}`;
      const score = tc.score !== undefined && tc.score !== null ? Number(tc.score) : 0;
      const isSample = !!tc.isSample;
      const isTrap = !!tc.isTrap;

      const inFileName = `${tcName}.inp`;
      const outFileName = `${tcName}.out`;
      const inAbsPath = path.join(probStorageDir, inFileName);
      const outAbsPath = path.join(probStorageDir, outFileName);

      fs.writeFileSync(inAbsPath, tc.input || '', 'utf8');
      fs.writeFileSync(outAbsPath, tc.expectedOutput || '', 'utf8');

      // Lưu đường dẫn tương đối để dễ backup / di chuyển thư mục
      const inRelPath = path.relative(process.cwd(), inAbsPath);
      const outRelPath = path.relative(process.cwd(), outAbsPath);

      await client.query(`
        INSERT INTO test_cases (id, problem_id, test_index, name, score, is_sample, is_trap, input_path, output_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [tcId, problemId, testIdx, tcName, score, isSample, isTrap, inRelPath, outRelPath]);
    }

    // 3. Cập nhật test_count trong problems
    await client.query('UPDATE problems SET test_count = $1 WHERE id = $2', [list.length, problemId]);
  });
}

/**
 * Lấy danh sách các bài tập
 */
async function getProblems(options = {}) {
  const sql = `
    SELECT 
      id, code, title, difficulty, points, time_limit AS "timeLimit",
      memory_limit AS "memoryLimit", category, description, statement,
      statement_html AS "statementHtml", sample_code AS "sampleCode",
      pdf_url AS "pdfUrl", pdf_file_name AS "pdfFileName",
      samples, test_count AS "testCount", created_at AS "createdAt"
    FROM problems
    ORDER BY created_at DESC
  `;
  const res = await query(sql);
  
  if (options.includeTestCases) {
    // Nếu yêu cầu kèm testcase đầy đủ
    return await Promise.all(res.rows.map(async (prob) => {
      const testCases = await getProblemTestCases(prob.id);
      return { ...prob, testCases };
    }));
  }

  // Mặc định trả về metadata nhẹ kèm samples
  return res.rows.map(prob => ({
    ...prob,
    testCases: []
  }));
}

/**
 * Lấy chi tiết một bài tập theo ID hoặc Code
 */
async function getProblem(idOrCode, options = {}) {
  if (!idOrCode) return null;
  const sql = `
    SELECT 
      id, code, title, difficulty, points, time_limit AS "timeLimit",
      memory_limit AS "memoryLimit", category, description, statement,
      statement_html AS "statementHtml", sample_code AS "sampleCode",
      pdf_url AS "pdfUrl", pdf_file_name AS "pdfFileName",
      samples, test_count AS "testCount", created_at AS "createdAt"
    FROM problems
    WHERE id = $1 OR UPPER(code) = UPPER($1)
  `;
  const res = await query(sql, [idOrCode]);
  if (res.rows.length === 0) return null;
  const prob = res.rows[0];

  if (options.includeTestCases !== false) {
    prob.testCases = await getProblemTestCases(prob.id);
  } else {
    prob.testCases = [];
  }
  return prob;
}

/**
 * Tạo một bài tập mới
 */
async function createProblem(prob) {
  const id = prob.id || newId('prob');
  const code = String(prob.code || 'BAI').toUpperCase().trim();
  const title = String(prob.title || prob.code || 'Bài tập').trim();
  const difficulty = prob.difficulty || 'Trung bình';
  const points = Number(prob.points) || 100;
  const timeLimit = Number(prob.timeLimit) || 1000;
  const memoryLimit = Number(prob.memoryLimit) || 256;
  const category = prob.category || 'C++11';
  const description = prob.description || '';
  const statement = prob.statement || '';
  const statementHtml = prob.statementHtml || '';
  const sampleCode = prob.sampleCode || '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Code C++\n    return 0;\n}\n';
  const pdfUrl = prob.pdfUrl || '';
  const pdfFileName = prob.pdfFileName || '';
  const samples = Array.isArray(prob.samples) ? prob.samples : [];
  const rawTestCases = Array.isArray(prob.testCases) ? prob.testCases : [];

  const sql = `
    INSERT INTO problems (
      id, code, title, difficulty, points, time_limit, memory_limit,
      category, description, statement, statement_html, sample_code,
      pdf_url, pdf_file_name, samples, test_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id, code, title, difficulty, points, time_limit AS "timeLimit",
              memory_limit AS "memoryLimit", category, description, statement,
              statement_html AS "statementHtml", sample_code AS "sampleCode",
              pdf_url AS "pdfUrl", pdf_file_name AS "pdfFileName",
              samples, test_count AS "testCount", created_at AS "createdAt"
  `;

  const res = await query(sql, [
    id, code, title, difficulty, points, timeLimit, memoryLimit,
    category, description, statement, statementHtml, sampleCode,
    pdfUrl, pdfFileName, JSON.stringify(samples), rawTestCases.length
  ]);
  const created = res.rows[0];

  // Lưu testcases vào storage nếu có
  if (rawTestCases.length > 0) {
    await setProblemTestCases(id, rawTestCases);
  }

  return { ...created, testCases: rawTestCases };
}

/**
 * Cập nhật thông tin bài tập
 */
async function updateProblem(id, updates = {}) {
  const current = await getProblem(id, { includeTestCases: false });
  if (!current) return null;

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.code !== undefined) {
    fields.push(`code = $${idx++}`);
    values.push(String(updates.code).toUpperCase().trim());
  }
  if (updates.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(String(updates.title).trim());
  }
  if (updates.difficulty !== undefined) {
    fields.push(`difficulty = $${idx++}`);
    values.push(updates.difficulty);
  }
  if (updates.points !== undefined) {
    fields.push(`points = $${idx++}`);
    values.push(Number(updates.points));
  }
  if (updates.timeLimit !== undefined) {
    fields.push(`time_limit = $${idx++}`);
    values.push(Number(updates.timeLimit));
  }
  if (updates.memoryLimit !== undefined) {
    fields.push(`memory_limit = $${idx++}`);
    values.push(Number(updates.memoryLimit));
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${idx++}`);
    values.push(updates.category);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(updates.description);
  }
  if (updates.statement !== undefined) {
    fields.push(`statement = $${idx++}`);
    values.push(updates.statement);
  }
  if (updates.statementHtml !== undefined) {
    fields.push(`statement_html = $${idx++}`);
    values.push(updates.statementHtml);
  }
  if (updates.sampleCode !== undefined) {
    fields.push(`sample_code = $${idx++}`);
    values.push(updates.sampleCode);
  }
  if (updates.pdfUrl !== undefined) {
    fields.push(`pdf_url = $${idx++}`);
    values.push(updates.pdfUrl);
  }
  if (updates.pdfFileName !== undefined) {
    fields.push(`pdf_file_name = $${idx++}`);
    values.push(updates.pdfFileName);
  }
  if (updates.samples !== undefined) {
    fields.push(`samples = $${idx++}`);
    values.push(JSON.stringify(Array.isArray(updates.samples) ? updates.samples : []));
  }

  if (fields.length > 0) {
    values.push(current.id);
    const sql = `UPDATE problems SET ${fields.join(', ')} WHERE id = $${idx}`;
    await query(sql, values);
  }

  // Nếu cập nhật danh sách testcase
  if (Array.isArray(updates.testCases)) {
    await setProblemTestCases(current.id, updates.testCases);
  }

  return await getProblem(current.id);
}

/**
 * Xóa một bài tập và dọn dẹp thư mục testcase tương ứng
 */
async function deleteProblem(id) {
  const res = await query('DELETE FROM problems WHERE id = $1 RETURNING id', [id]);
  if (res.rows.length > 0) {
    try {
      const probStorageDir = path.join(getStorageDir(), id);
      if (fs.existsSync(probStorageDir)) {
        fs.rmSync(probStorageDir, { recursive: true, force: true });
      }
    } catch (e) {}
    return true;
  }
  return false;
}

module.exports = {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  getProblemTestCases,
  setProblemTestCases
};
