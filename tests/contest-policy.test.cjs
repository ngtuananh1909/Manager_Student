const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ContestPolicyError,
  assertJoinAllowed,
  assertSubmissionAllowed
} = require('../server/contestPolicy.cjs');
const {
  sanitizeContestForStudent,
  sanitizeProblemForStudent,
  sanitizeSubmissionForStudent
} = require('../server/serializers.cjs');

const now = Date.parse('2026-10-01T02:00:00.000Z');
const user = { id: 'usr-1', role: 'user', classId: 'cls-1', isLocked: false };

function contest(overrides = {}) {
  return {
    id: 'cnt-1',
    title: 'Contest',
    status: 'running',
    startTime: '2026-10-01T01:00:00.000Z',
    endTime: '2026-10-01T03:00:00.000Z',
    classIds: ['cls-1'],
    candidateIds: ['usr-1'],
    problemIds: ['prob-1'],
    pinCode: '2468',
    ...overrides
  };
}

function expectPolicyCode(callback, code) {
  assert.throws(callback, error => error instanceof ContestPolicyError && error.code === code);
}

test('contest join enforces PIN, candidate, class, start/end and suspension', () => {
  assert.doesNotThrow(() => assertJoinAllowed({
    contest: contest(), user, suppliedPin: '2468', attendance: null, now
  }));

  expectPolicyCode(() => assertJoinAllowed({ contest: contest(), user, suppliedPin: 'wrong', now }), 'INVALID_CONTEST_PIN');
  expectPolicyCode(() => assertJoinAllowed({ contest: contest({ candidateIds: ['usr-2'] }), user, suppliedPin: '2468', now }), 'NOT_A_CANDIDATE');
  expectPolicyCode(() => assertJoinAllowed({ contest: contest({ candidateIds: [], classIds: ['cls-2'] }), user, suppliedPin: '2468', now }), 'CLASS_NOT_ELIGIBLE');
  expectPolicyCode(() => assertJoinAllowed({ contest: contest({ startTime: '2026-10-01T02:30:00.000Z' }), user, suppliedPin: '2468', now }), 'CONTEST_NOT_STARTED');
  expectPolicyCode(() => assertJoinAllowed({ contest: contest({ endTime: '2026-10-01T01:30:00.000Z' }), user, suppliedPin: '2468', now }), 'CONTEST_ENDED');
  expectPolicyCode(() => assertJoinAllowed({ contest: contest(), user, suppliedPin: '2468', attendance: { status: 'suspended' }, now }), 'PARTICIPATION_SUSPENDED');
});

test('extra time extends the server-authoritative submission deadline', () => {
  const ended = contest({ endTime: '2026-10-01T01:50:00.000Z' });
  assert.doesNotThrow(() => assertSubmissionAllowed({
    contest: ended,
    user,
    attendance: { status: 'present', extraMinutes: 15 },
    now,
    joined: true,
    problemId: 'prob-1'
  }));
  expectPolicyCode(() => assertSubmissionAllowed({
    contest: ended,
    user,
    attendance: { status: 'present', extraMinutes: 5 },
    now,
    joined: true,
    problemId: 'prob-1'
  }), 'CONTEST_ENDED');
});

test('contest submissions require a joined session and a problem in the contest', () => {
  expectPolicyCode(() => assertSubmissionAllowed({
    contest: contest(), user, now, joined: false, problemId: 'prob-1'
  }), 'CONTEST_JOIN_REQUIRED');
  expectPolicyCode(() => assertSubmissionAllowed({
    contest: contest(), user, now, joined: true, problemId: 'prob-outside'
  }), 'PROBLEM_NOT_IN_CONTEST');
});

test('student serializers expose explicit samples but no hidden or privileged fields', () => {
  const problem = sanitizeProblemForStudent({
    id: 'prob-1',
    code: 'SUM',
    title: 'Sum',
    points: 100,
    testCases: [
      { id: 'hidden', input: 'secret', expectedOutput: 'secret-out', isSample: false },
      { id: 'sample', input: '1 2', expectedOutput: '3', isSample: true }
    ],
    _pdfDiskPath: '/secret/path'
  });
  assert.deepEqual(problem.samples, [{ id: 'sample-1', name: 'Ví dụ 1', input: '1 2', output: '3' }]);
  assert.deepEqual(problem.testCases, []);
  assert.equal('_pdfDiskPath' in problem, false);
  assert.equal(JSON.stringify(problem).includes('secret-out'), false);

  const studentContest = sanitizeContestForStudent(contest({
    _pdfDiskPath: '/secret/contest',
    problems: [problem]
  }));
  assert.equal('pinCode' in studentContest, false);
  assert.equal('candidateIds' in studentContest, false);
  assert.equal('_pdfDiskPath' in studentContest, false);

  const submission = sanitizeSubmissionForStudent({
    id: 'sub-1', userId: 'usr-1', code: 'int main(){}', status: 'WA', details: [{
      testIndex: 1, status: 'WA', input: 'hidden-in', expectedOutput: 'hidden-out', userOutput: 'x', diff: ['secret']
    }]
  });
  assert.equal(submission.code, 'int main(){}');
  assert.equal(JSON.stringify(submission).includes('hidden-in'), false);
  assert.equal(JSON.stringify(submission).includes('hidden-out'), false);
  assert.equal(JSON.stringify(submission).includes('secret'), false);
});
