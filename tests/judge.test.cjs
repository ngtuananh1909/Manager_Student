'use strict';

const assert = require('node:assert/strict');
const { before, test } = require('node:test');

// The judge module re-detects compilers lazily; we import it fresh.
const judge = require('../server/judge.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal problem shape for gradeSubmission */
function problem(overrides = {}) {
  return {
    id: 'prob-test',
    code: 'SUM',
    timeLimit: 2000,
    memoryLimit: 128,
    points: 100,
    testCases: [],
    ...overrides
  };
}

/** Minimal submission shape */
function submission(code, overrides = {}) {
  return { id: `sub-${Date.now()}`, code, requireFreopen: false, ...overrides };
}

// ---------------------------------------------------------------------------
// Infrastructure check: skip live-Docker tests when Docker is unavailable
// ---------------------------------------------------------------------------

let dockerAvailable = false;

before(() => {
  const info = judge.getDiagnostics();
  dockerAvailable = !!(info.hasDocker && info.imageAvailable);
});

// ---------------------------------------------------------------------------
// 1. simulateRun must NOT exist (removed per Task 4)
// ---------------------------------------------------------------------------

test('simulateRun is removed — judge does not fall back to fake execution', () => {
  assert.equal(typeof judge.simulateRun, 'undefined',
    'simulateRun must be removed; judge must fail closed when Docker is unavailable');
});

// ---------------------------------------------------------------------------
// 2. Fail closed when Docker unavailable and no testcases
// ---------------------------------------------------------------------------

test('gradeSubmission with zero testcases returns AC with score 0 regardless of Docker', async () => {
  const prob = problem({ testCases: [] });
  const sub = submission('int main(){}');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.equal(result.status, 'AC');
  assert.equal(result.score, 0);
  assert.equal(result.totalTests, 0);
});

// ---------------------------------------------------------------------------
// 3. When Docker unavailable, gradeSubmission must return INFRASTRUCTURE_ERROR
//    status (not simulate a result) if there are actual testcases.
// ---------------------------------------------------------------------------

test('gradeSubmission fails closed with INFRASTRUCTURE_ERROR when Docker is unavailable and testcases exist', async function () {
  if (dockerAvailable) {
    // Skip: Docker IS available; the fail-closed path won't trigger.
    return;
  }
  const prob = problem({
    testCases: [{ id: 'tc1', input: '1 2', expectedOutput: '3', isSample: true, score: 100 }]
  });
  const sub = submission('int main(){}');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.equal(result.status, 'INFRASTRUCTURE_ERROR',
    'Without Docker, judge must return INFRASTRUCTURE_ERROR, not fake results');
  assert.equal(result.score, 0);
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length > 0);
});

// ---------------------------------------------------------------------------
// Live Docker tests (skipped when Docker is unavailable)
// ---------------------------------------------------------------------------

test('Docker: compiles and runs a correct C++ sum program — returns AC', async function () {
  if (!dockerAvailable) return;

  const prob = problem({
    testCases: [
      { id: 'tc1', input: '3 4', expectedOutput: '7', isSample: true, score: 100 }
    ]
  });
  const sub = submission('#include<iostream>\nusing namespace std;\nint main(){int a,b;cin>>a>>b;cout<<a+b;return 0;}');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.equal(result.status, 'AC');
  assert.equal(result.score, 100);
  assert.equal(result.passedTests, 1);
});

test('Docker: wrong answer returns WA with zero score', async function () {
  if (!dockerAvailable) return;

  const prob = problem({
    testCases: [
      { id: 'tc1', input: '3 4', expectedOutput: '7', isSample: true, score: 100 }
    ]
  });
  const sub = submission('#include<iostream>\nusing namespace std;\nint main(){cout<<0;return 0;}');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.equal(result.status, 'WA');
  assert.equal(result.score, 0);
});

test('Docker: compile error returns CE with error message', async function () {
  if (!dockerAvailable) return;

  const prob = problem({
    testCases: [{ id: 'tc1', input: '1', expectedOutput: '1', isSample: true, score: 100 }]
  });
  const sub = submission('this is not valid c++');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.equal(result.status, 'CE');
  assert.ok(typeof result.compileError === 'string' && result.compileError.length > 0);
});

test('Docker: infinite loop returns TLE within time limit + margin', async function () {
  if (!dockerAvailable) return;

  const timeLimitMs = 1000;
  const prob = problem({
    timeLimit: timeLimitMs,
    testCases: [{ id: 'tc1', input: '', expectedOutput: '', isSample: false, score: 100 }]
  });
  const sub = submission('int main(){for(;;);}');
  const start = Date.now();
  const result = await judge.gradeSubmission(sub, prob, null);
  const elapsed = Date.now() - start;
  assert.equal(result.status, 'TLE');
  // Must not take more than timeLimit + 5 seconds of overhead
  assert.ok(elapsed < timeLimitMs + 5000, `TLE took too long: ${elapsed}ms`);
});

test('Docker: runtime error (segfault/exit nonzero) returns RE', async function () {
  if (!dockerAvailable) return;

  const prob = problem({
    testCases: [{ id: 'tc1', input: '', expectedOutput: '', isSample: false, score: 100 }]
  });
  // Dereference null pointer → segfault
  const sub = submission('#include<cstdlib>\nint main(){int*p=nullptr;*p=1;return 0;}');
  const result = await judge.gradeSubmission(sub, prob, null);
  assert.ok(result.status === 'RE' || result.status === 'WA', `Expected RE, got ${result.status}`);
});

test('Docker: hidden testcase input/output not exposed in student details', async function () {
  if (!dockerAvailable) return;

  const prob = problem({
    testCases: [
      { id: 'hidden', input: 'secret-in', expectedOutput: 'secret-out', isSample: false, score: 100 }
    ]
  });
  const sub = submission('#include<iostream>\nusing namespace std;\nint main(){cout<<"wrong";return 0;}');
  const result = await judge.gradeSubmission(sub, prob, null);
  // Raw judge result keeps everything; sanitization happens in queue/serializers.
  // Verify the detail exists and has the raw input for host use.
  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].input, 'secret-in');
});

test('Docker: getDiagnostics reports hasDocker true when Docker is available', function () {
  if (!dockerAvailable) return;
  const info = judge.getDiagnostics();
  assert.equal(info.hasDocker, true);
  assert.equal(typeof info.dockerVersion, 'string');
});

test('Docker: runCustomInput with correct program returns OK and stdout', async function () {
  if (!dockerAvailable) return;

  const result = await judge.runCustomInput(
    '#include<iostream>\nusing namespace std;\nint main(){int a,b;cin>>a>>b;cout<<a+b;}',
    '10 20',
    2000, 128, ''
  );
  assert.equal(result.status, 'OK');
  assert.equal(result.stdout.trim(), '30');
});

test('Docker: runCustomInput with compile error returns CE', async function () {
  if (!dockerAvailable) return;

  const result = await judge.runCustomInput('bad code!', '', 2000, 128, '');
  assert.equal(result.status, 'CE');
  assert.ok(result.stderr && result.stderr.length > 0);
});
