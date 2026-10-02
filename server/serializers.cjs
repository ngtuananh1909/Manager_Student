function sanitizeProblemForStudent(problem) {
  if (!problem) return null;
  const samples = Array.isArray(problem.samples) && problem.samples.length > 0
    ? problem.samples.map(sample => ({ ...sample }))
    : [];

  return {
    id: problem.id,
    code: problem.code,
    title: problem.title,
    difficulty: problem.difficulty,
    points: problem.points || 100,
    timeLimit: problem.timeLimit || 1000,
    memoryLimit: problem.memoryLimit || 256,
    category: problem.category,
    description: problem.description || '',
    inputDescription: problem.inputDescription || '',
    outputDescription: problem.outputDescription || '',
    constraints: problem.constraints || '',
    statement: problem.statement || '',
    statementHtml: problem.statementHtml || '',
    sampleCode: problem.sampleCode,
    pdfUrl: problem.pdfUrl,
    pdfFileName: problem.pdfFileName,
    testCount: problem.testCount ?? (Array.isArray(problem.testCases) ? problem.testCases.length : 0),
    samples,
    testCases: []
  };
}

function sanitizeProblemForHost(problem) {
  if (!problem) return null;
  const safe = { ...problem };
  delete safe._pdfDiskPath;
  safe.testCount = problem.testCount ?? (Array.isArray(problem.testCases) ? problem.testCases.length : 0);
  safe.testCases = [];
  return safe;
}

function sanitizeContestForStudent(contest, problems) {
  if (!contest) return null;
  const safe = { ...contest };
  delete safe.pinCode;
  delete safe.candidateIds;
  delete safe._pdfDiskPath;
  safe.requiresPin = !!contest.pinCode;
  if (problems !== undefined) safe.problems = (problems || []).map(sanitizeProblemForStudent);
  else if (Array.isArray(safe.problems)) safe.problems = safe.problems.map(sanitizeProblemForStudent);
  return safe;
}

function sanitizeContestForHost(contest, problems) {
  if (!contest) return null;
  const safe = { ...contest };
  delete safe._pdfDiskPath;
  if (problems !== undefined) safe.problems = (problems || []).map(sanitizeProblemForHost);
  else if (Array.isArray(safe.problems)) safe.problems = safe.problems.map(sanitizeProblemForHost);
  return safe;
}

function sanitizeSubmissionForStudent(submission) {
  if (!submission) return null;
  return {
    id: submission.id,
    userId: submission.userId,
    userName: submission.userName,
    problemId: submission.problemId,
    problemCode: submission.problemCode,
    code: submission.code,
    status: submission.status,
    score: submission.score,
    passedTests: submission.passedTests,
    totalTests: submission.totalTests,
    executionTime: submission.executionTime,
    memoryUsed: submission.memoryUsed,
    submittedAt: submission.submittedAt,
    compileError: submission.compileError,
    contestId: submission.contestId,
    isVirtual: !!submission.isVirtual,
    participationType: submission.participationType,
    virtualSessionId: submission.virtualSessionId,
    details: (submission.details || []).map(detail => ({
      testIndex: detail.testIndex,
      name: detail.name,
      status: detail.status,
      time: detail.time,
      memory: detail.memory,
      scoreEarned: detail.scoreEarned,
      message: detail.message
    }))
  };
}

module.exports = {
  sanitizeContestForHost,
  sanitizeContestForStudent,
  sanitizeProblemForHost,
  sanitizeProblemForStudent,
  sanitizeSubmissionForStudent
};
