'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Docker image used for all compilation and execution.
// The image must be pre-pulled on the host. Judge fails closed if unavailable.
// ---------------------------------------------------------------------------
const DOCKER_IMAGE = 'gcc:13-bookworm';

// ---------------------------------------------------------------------------
// Resource ceilings (Docker flags). These are upper bounds; per-problem limits
// are enforced by the watchdog timer and output cap inside the container.
// ---------------------------------------------------------------------------
const DOCKER_MEMORY_BYTES = 256 * 1024 * 1024;  // 256 MiB hard ceiling
const DOCKER_SWAP_BYTES = 256 * 1024 * 1024;    // swap = memory (disable extra swap)
const DOCKER_CPU_QUOTA = 100000;                  // 1 CPU core (period=100000)
const DOCKER_PIDS_LIMIT = 64;
const OUTPUT_CAP_BYTES = 4 * 1024 * 1024;        // 4 MiB per test output cap

class JudgeEngine {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'schooljudge_runner');
    try {
      fs.mkdirSync(this.tempDir, { recursive: true });
    } catch (e) {
      this.tempDir = path.join(process.cwd(), '.temp_runner');
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this._compilerInfo = null; // lazy
  }

  // ── Compiler detection ────────────────────────────────────────────────────

  detectCompilers() {
    let hasDocker = false;
    let dockerVersion = '';
    let imageAvailable = false;

    try {
      const out = execSync('docker --version', {
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim();
      hasDocker = true;
      dockerVersion = out;
    } catch (e) {
      hasDocker = false;
    }

    if (hasDocker) {
      try {
        execSync(`docker image inspect ${DOCKER_IMAGE}`, {
          timeout: 5000,
          stdio: ['ignore', 'ignore', 'ignore']
        });
        imageAvailable = true;
      } catch (e) {
        imageAvailable = false;
      }
    }

    return {
      hasDocker,
      dockerVersion,
      imageAvailable,
      dockerImage: DOCKER_IMAGE,
      platform: process.platform
    };
  }

  getDiagnostics() {
    this._compilerInfo = this.detectCompilers();
    return this._compilerInfo;
  }

  _getCompilerInfo() {
    if (!this._compilerInfo) {
      this._compilerInfo = this.detectCompilers();
    }
    return this._compilerInfo;
  }

  // ── Output normalisation ──────────────────────────────────────────────────

  normalizeOutput(str) {
    if (!str) return '';
    return str
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
  }

  // ── Line-level diff (LCS-based) ───────────────────────────────────────────

  computeDiff(actualStr, expectedStr, maxLines = 150) {
    const actualLines = actualStr.split('\n');
    const expectedLines = expectedStr.split('\n');
    const am = Math.min(actualLines.length, 500);
    const en = Math.min(expectedLines.length, 500);

    const dp = Array.from({ length: am + 1 }, () => new Int32Array(en + 1));
    for (let i = 1; i <= am; i++) {
      for (let j = 1; j <= en; j++) {
        if (actualLines[i - 1] === expectedLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = am, j = en;
    const raw = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && actualLines[i - 1] === expectedLines[j - 1]) {
        raw.push({ type: 'equal', actual: actualLines[i - 1], expected: expectedLines[j - 1], ai: i - 1, ei: j - 1 });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        raw.push({ type: 'removed', expected: expectedLines[j - 1], ei: j - 1 });
        j--;
      } else {
        raw.push({ type: 'added', actual: actualLines[i - 1], ai: i - 1 });
        i--;
      }
    }
    raw.reverse();

    const normalized = [];
    let idx = 0;
    while (idx < raw.length) {
      const seg = raw[idx];
      if (seg.type === 'equal') {
        normalized.push({ type: 'equal', lineNo: (seg.ei ?? seg.ai) + 1, content: seg.expected });
        idx++;
      } else if (seg.type === 'removed') {
        if (idx + 1 < raw.length && raw[idx + 1].type === 'added') {
          const next = raw[idx + 1];
          normalized.push({ type: 'modified', lineNo: seg.ei + 1, content: next.actual, expectedContent: seg.expected });
          idx += 2;
        } else {
          normalized.push({ type: 'removed', lineNo: seg.ei + 1, content: seg.expected });
          idx++;
        }
      } else {
        if (idx + 1 < raw.length && raw[idx + 1].type === 'removed') {
          const next = raw[idx + 1];
          normalized.push({ type: 'modified', lineNo: next.ei + 1, content: seg.actual, expectedContent: next.expected });
          idx += 2;
        } else {
          normalized.push({ type: 'added', lineNo: (seg.ai ?? 0) + 1, content: seg.actual });
          idx++;
        }
      }
    }

    const totalDiffCount = normalized.filter(l => l.type !== 'equal').length;
    const truncated = normalized.length > maxLines;
    return { diff: normalized.slice(0, maxLines), truncated, totalDiffCount };
  }

  // ── Docker: compile C++ source into a named binary ────────────────────────

  async compileCode(subId, code) {
    const subFolder = path.join(this.tempDir, `sub_${subId}_${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(subFolder, { recursive: true });

    const sourcePath = path.join(subFolder, 'solution.cpp');
    fs.writeFileSync(sourcePath, code, 'utf8');

    // Compile inside Docker: mount only the per-submission folder read-write
    const compileArgs = [
      'run', '--rm',
      '--network=none',
      '--read-only',
      `--tmpfs=/tmp:size=64m`,
      `--volume=${subFolder}:/work:rw`,
      `--workdir=/work`,
      `--memory=${DOCKER_MEMORY_BYTES}`,
      `--memory-swap=${DOCKER_SWAP_BYTES}`,
      `--cpus=1`,
      `--pids-limit=${DOCKER_PIDS_LIMIT}`,
      '--security-opt=no-new-privileges',
      '--user=65534:65534', // nobody
      '--cap-drop=ALL',
      DOCKER_IMAGE,
      'g++', '-O2', '-std=c++17', '-o', '/work/solution', '/work/solution.cpp'
    ];

    return new Promise((resolve) => {
      let stderr = '';
      const child = spawn('docker', compileArgs, {
        stdio: ['ignore', 'ignore', 'pipe']
      });

      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (e) {}
        fs.rmSync(subFolder, { recursive: true, force: true });
        resolve({ success: false, error: 'Compile timeout (10 000 ms)' });
      }, 10000);

      child.stderr.on('data', (d) => {
        if (stderr.length < 64 * 1024) stderr += d.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        fs.rmSync(subFolder, { recursive: true, force: true });
        resolve({ success: false, error: `docker spawn failed: ${err.message}` });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const binaryPath = path.join(subFolder, 'solution');
        if (code !== 0 || !fs.existsSync(binaryPath)) {
          fs.rmSync(subFolder, { recursive: true, force: true });
          resolve({ success: false, error: stderr || `g++ exited ${code}` });
        } else {
          resolve({ success: true, binaryPath, subFolder });
        }
      });
    });
  }

  // ── Docker: run a compiled binary against one test input ──────────────────

  async runSingleTest(binaryPath, subFolder, inputData, timeLimitMs, memoryLimitMb, problemCode = '', requireFreopen = false) {
    const memBytes = Math.min(memoryLimitMb * 1024 * 1024, DOCKER_MEMORY_BYTES);
    const codeName = problemCode ? problemCode.trim() : '';

    // Collect candidate problem/task names for file I/O (.inp / .out)
    const candidateNames = new Set();
    if (codeName) {
      candidateNames.add(codeName);
      candidateNames.add(codeName.toLowerCase());
      candidateNames.add(codeName.toUpperCase());
    }

    // Inspect solution.cpp in subFolder to discover any defined TASK or freopen target
    try {
      const srcPath = path.join(subFolder, 'solution.cpp');
      if (fs.existsSync(srcPath)) {
        const srcContent = fs.readFileSync(srcPath, 'utf8');
        const taskMatch = srcContent.match(/#define\s+TASK\s+["']([^"'\\]+)["']/i);
        if (taskMatch && taskMatch[1]) {
          candidateNames.add(taskMatch[1]);
          candidateNames.add(taskMatch[1].toLowerCase());
          candidateNames.add(taskMatch[1].toUpperCase());
        }
        const freopenMatches = srcContent.matchAll(/freopen\s*\(\s*["']([^"'\\]+)\.inp["']/gi);
        for (const fm of freopenMatches) {
          if (fm && fm[1]) {
            candidateNames.add(fm[1]);
            candidateNames.add(fm[1].toLowerCase());
            candidateNames.add(fm[1].toUpperCase());
          }
        }
      }
    } catch (e) {}

    // Clean up any stale .out files in subFolder before running
    try {
      const files = fs.readdirSync(subFolder);
      for (const f of files) {
        if (f.toLowerCase().endsWith('.out')) {
          try { fs.unlinkSync(path.join(subFolder, f)); } catch (e) {}
        }
      }
    } catch (e) {}

    // Write .inp files for all candidate names and '.inp'
    const createdInpPaths = [];
    const writeInp = (filename) => {
      try {
        const p = path.join(subFolder, filename);
        fs.writeFileSync(p, inputData, 'utf8');
        createdInpPaths.push(p);
      } catch (e) {}
    };

    writeInp('.inp');
    writeInp('.INP');
    for (const name of candidateNames) {
      writeInp(`${name}.inp`);
      writeInp(`${name}.INP`);
    }

    const runArgs = [
      'run', '--rm',
      '--network=none',
      '--read-only',
      `--tmpfs=/tmp:size=32m`,
      `--volume=${subFolder}:/work:rw`,
      `--workdir=/work`,
      `--memory=${memBytes}`,
      `--memory-swap=${memBytes}`,
      `--cpu-quota=${DOCKER_CPU_QUOTA}`,
      `--pids-limit=${DOCKER_PIDS_LIMIT}`,
      '--security-opt=no-new-privileges',
      '--user=65534:65534',
      '--cap-drop=ALL',
      DOCKER_IMAGE,
      '/work/solution'
    ];

    return new Promise((resolve) => {
      const startTime = process.hrtime.bigint();
      let stdout = '';
      let stderr = '';
      let isTimeout = false;

      const child = spawn('docker', runArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        isTimeout = true;
        try { child.kill('SIGKILL'); } catch (e) {}
      }, timeLimitMs + 1000); // +1s for Docker overhead

      try {
        child.stdin.write(inputData);
        child.stdin.end();
      } catch (e) {}

      child.stdout.on('data', (chunk) => {
        if (stdout.length < OUTPUT_CAP_BYTES) stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        if (stderr.length < 8 * 1024) stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const durationMs = Number((process.hrtime.bigint() - startTime) / 1000000n);
        resolve({ status: 'RE', error: err.message, time: durationMs, memory: 0, output: stdout });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Math.max(1, Number((process.hrtime.bigint() - startTime) / 1000000n));

        // Read freopen .out file if present (check all candidate files or any file ending in .out)
        let effectiveOutput = stdout;
        let foundOutFile = false;

        try {
          const files = fs.readdirSync(subFolder);
          const outFiles = files.filter(f => f.toLowerCase().endsWith('.out'));
          for (const ofile of outFiles) {
            const outPath = path.join(subFolder, ofile);
            if (fs.existsSync(outPath) && fs.statSync(outPath).isFile()) {
              const fc = fs.readFileSync(outPath, 'utf8');
              foundOutFile = true;
              if (fc.length > 0 || !effectiveOutput.trim()) {
                effectiveOutput = fc;
                break;
              }
            }
          }
        } catch (e) {}

        // Cleanup all created inp and generated out files
        for (const p of createdInpPaths) {
          try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
        }
        try {
          const files = fs.readdirSync(subFolder);
          for (const f of files) {
            if (f.toLowerCase().endsWith('.out') || f.toLowerCase().endsWith('.inp') || f === '.inp' || f === '.out') {
              try { fs.unlinkSync(path.join(subFolder, f)); } catch (e) {}
            }
          }
        } catch (e) {}

        // Strict freopen check
        if (requireFreopen && !foundOutFile) {
          return resolve({
            status: 'WA', time: durationMs, memory: 0, output: effectiveOutput,
            message: `Quy chế thi bắt buộc dùng freopen. Không tìm thấy tệp đầu ra (.out).`
          });
        }

        if (isTimeout) {
          return resolve({
            status: 'TLE', time: timeLimitMs, memory: memoryLimitMb || 0,
            output: effectiveOutput,
            message: `Chạy quá thời gian quy định (${timeLimitMs}ms)`
          });
        }

        // OOM: Docker exits 137 on OOM kill
        if (code === 137 && !isTimeout) {
          return resolve({
            status: 'MLE', time: durationMs, memory: memoryLimitMb,
            output: '', message: `Vượt giới hạn bộ nhớ (${memoryLimitMb} MiB)`
          });
        }

        if (code !== 0) {
          return resolve({
            status: 'RE', time: durationMs, memory: 0, output: effectiveOutput,
            message: `Runtime Error (exit ${code}): ${stderr || 'Segmentation fault hoặc chia cho 0'}`
          });
        }

        resolve({ status: 'OK', time: durationMs, memory: 0, output: effectiveOutput });
      });
    });
  }

  // ── Main gradeSubmission ──────────────────────────────────────────────────

  async gradeSubmission(submission, problem, onProgress) {
    const { id, code } = submission;
    const testCases = problem.testCases || [];
    const timeLimit = problem.timeLimit || 1000;
    const memoryLimit = problem.memoryLimit || 128;

    // Zero testcases → AC immediately
    if (testCases.length === 0) {
      return {
        status: 'AC', score: 0, passedTests: 0, totalTests: 0,
        executionTime: 0, memoryUsed: 0, details: []
      };
    }

    if (onProgress) onProgress({ status: 'COMPILING', message: 'Đang biên dịch C++ bằng Docker (g++ -O2 -std=c++17)...' });

    // Fail closed: Docker required
    const info = this._getCompilerInfo();
    if (!info.hasDocker || !info.imageAvailable) {
      const reason = !info.hasDocker
        ? 'Docker không khả dụng trên hệ thống này. Vui lòng cài đặt Docker để chấm bài.'
        : `Docker image "${DOCKER_IMAGE}" chưa được pull. Chạy: docker pull ${DOCKER_IMAGE}`;
      return {
        status: 'INFRASTRUCTURE_ERROR',
        score: 0, passedTests: 0, totalTests: testCases.length,
        executionTime: 0, memoryUsed: 0,
        message: reason,
        details: testCases.map((_, idx) => ({
          testIndex: idx + 1, status: 'INFRASTRUCTURE_ERROR',
          time: 0, memory: 0, message: reason
        }))
      };
    }

    // Compile
    const compileRes = await this.compileCode(id, code);
    if (!compileRes.success) {
      const ceMsg = compileRes.error || 'Lỗi biên dịch';
      return {
        status: 'CE', score: 0, passedTests: 0, totalTests: testCases.length,
        executionTime: 0, memoryUsed: 0, compileError: ceMsg,
        details: testCases.map((_, idx) => ({
          testIndex: idx + 1, status: 'CE', time: 0, memory: 0, message: 'Lỗi biên dịch'
        }))
      };
    }

    const { binaryPath, subFolder } = compileRes;
    const testResults = [];
    let passedCount = 0;
    let earnedScore = 0;
    let maxTime = 0;
    let maxMem = 0;
    let overallStatus = 'AC';
    const maxProbPoints = problem.points !== undefined && problem.points !== null ? Number(problem.points) : 100;
    const defaultTestScore = testCases.length > 0 ? (maxProbPoints / testCases.length) : 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcWeight = (tc.score !== undefined && tc.score !== null) ? Number(tc.score) : defaultTestScore;

      if (onProgress) {
        onProgress({
          status: 'TESTING',
          currentTest: i + 1,
          totalTests: testCases.length,
          message: `Đang chấm test ${i + 1}/${testCases.length}${tc.isTrap ? ' [Test Bẫy]' : ''}...`
        });
      }

      const requireFreopen = !!submission.requireFreopen;
      const runResult = await this.runSingleTest(
        binaryPath, subFolder, tc.input, timeLimit, memoryLimit, problem.code, requireFreopen
      );

      maxTime = Math.max(maxTime, runResult.time || 0);
      maxMem = Math.max(maxMem, runResult.memory || 0);

      let testStatus = 'AC';
      let errorMsg = null;
      let diffResult = null;

      if (runResult.status === 'TLE') {
        testStatus = 'TLE';
        errorMsg = runResult.message;
      } else if (runResult.status === 'MLE') {
        testStatus = 'MLE';
        errorMsg = runResult.message;
      } else if (runResult.status === 'RE') {
        testStatus = 'RE';
        errorMsg = runResult.message;
      } else if (runResult.status === 'WA' && runResult.message) {
        // freopen enforcement
        testStatus = 'WA';
        errorMsg = runResult.message;
      } else {
        const actualNorm = this.normalizeOutput(runResult.output);
        const expectNorm = this.normalizeOutput(tc.expectedOutput);

        if (actualNorm === expectNorm) {
          testStatus = 'AC';
          passedCount++;
          earnedScore += tcWeight;
        } else {
          testStatus = 'WA';
          diffResult = this.computeDiff(actualNorm, expectNorm, 150);
          errorMsg = tc.isSample
            ? `Kết quả sai. Đầu ra: "${actualNorm.slice(0, 50)}", Kỳ vọng: "${expectNorm.slice(0, 50)}"`
            : 'Kết quả sai trên bộ test này.';
        }
      }

      if (testStatus !== 'AC' && overallStatus === 'AC') {
        overallStatus = testStatus;
      }

      const truncatePreview = (str, maxLen = 100000) => {
        if (!str) return '';
        const s = typeof str === 'string' ? str : String(str);
        return s.length <= maxLen ? s : s.slice(0, maxLen) + `\n... [Đã rút gọn ${s.length - maxLen} ký tự]`;
      };

      testResults.push({
        testIndex: i + 1,
        name: tc.name || `test${String(i + 1).padStart(2, '0')}`,
        status: testStatus,
        time: runResult.time,
        memory: runResult.memory,
        isSample: tc.isSample,
        isTrap: tc.isTrap,
        scoreEarned: testStatus === 'AC' ? Math.round(tcWeight * 100) / 100 : 0,
        message: errorMsg,
        input: truncatePreview(tc.input, 100000),
        userOutput: truncatePreview(runResult.output, 100000),
        expectedOutput: truncatePreview(tc.expectedOutput, 100000),
        diff: diffResult ? diffResult.diff : undefined,
        diffTruncated: diffResult ? diffResult.truncated : undefined
      });

      if (onProgress) {
        onProgress({
          status: 'TESTING',
          currentTest: i + 1,
          totalTests: testCases.length,
          lastTestIndex: i + 1,
          lastTestStatus: testStatus,
          lastTestTime: runResult.time,
          lastTestMemory: runResult.memory,
          details: testResults.map(tr => ({
            testIndex: tr.testIndex,
            name: tr.name,
            status: tr.status,
            time: tr.time,
            memory: tr.memory
          })),
          message: `Đã chấm test ${i + 1}/${testCases.length}: ${testStatus}`
        });
      }
    }

    // Cleanup per-submission workspace
    try { fs.rmSync(subFolder, { recursive: true, force: true }); } catch (e) {}

    const finalScore = passedCount === testCases.length
      ? maxProbPoints
      : Math.round(earnedScore * 10) / 10;

    return {
      status: overallStatus,
      score: finalScore,
      passedTests: passedCount,
      totalTests: testCases.length,
      executionTime: maxTime,
      memoryUsed: maxMem,
      details: testResults
    };
  }

  // ── runCustomInput (student custom test — no score impact) ────────────────

  async runCustomInput(code, customInput, timeLimit = 2000, memoryLimit = 256, problemCode = '') {
    const info = this._getCompilerInfo();
    if (!info.hasDocker || !info.imageAvailable) {
      const reason = !info.hasDocker
        ? 'Docker không khả dụng. Cần cài Docker để chạy thử.'
        : `Docker image "${DOCKER_IMAGE}" chưa được pull.`;
      return { status: 'INFRASTRUCTURE_ERROR', time: 0, memory: 0, stdout: '', stderr: reason };
    }

    const compileRes = await this.compileCode('custom_' + Date.now(), code);
    if (!compileRes.success) {
      return { status: 'CE', time: 0, memory: 0, stdout: '', stderr: compileRes.error };
    }

    let targetCode = problemCode ? problemCode.trim() : '';
    if (!targetCode && code) {
      const taskMatch = code.match(/#define\s+TASK\s+["']([^"'\\]+)["']/i);
      if (taskMatch && taskMatch[1]) {
        targetCode = taskMatch[1];
      } else {
        const m = code.match(/freopen\s*\(\s*["']([^"'\\]+)\.inp["']/i);
        if (m) targetCode = m[1];
      }
    }

    const result = await this.runSingleTest(
      compileRes.binaryPath, compileRes.subFolder,
      customInput, timeLimit, memoryLimit, targetCode
    );

    try { fs.rmSync(compileRes.subFolder, { recursive: true, force: true }); } catch (e) {}

    return {
      status: result.status,
      time: result.time,
      memory: result.memory,
      stdout: result.output || '',
      stderr: result.message || ''
    };
  }
}

module.exports = new JudgeEngine();
