/**
 * Centralized Scoring Resolution for SchoolJudge LAN
 * Supports 3 scoring modes:
 *  1. LIVE_BEST: Highest score per problem wins. Earliest submittedAt breaks score ties.
 *  2. OLYMPIC_LATEST: Latest submission per problem wins (regardless of score).
 *  3. PRETEST: Graded and saved, but excluded from official score and official leaderboard.
 */

const SCORING_MODES = {
  LIVE_BEST: 'LIVE_BEST',
  OLYMPIC_LATEST: 'OLYMPIC_LATEST',
  PRETEST: 'PRETEST'
};

function normalizeTimestamp(val) {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Resolves the final submission and score for a single problem by a student.
 * @param {Array} submissions - List of submissions for ONE problem by ONE student
 * @param {string} scoringMode - 'LIVE_BEST' | 'OLYMPIC_LATEST' | 'PRETEST'
 * @returns {object} { finalSubmission, finalScore, bestScore, latestScore, totalSubmissions, isOfficial }
 */
function resolveProblemSubmission(submissions = [], scoringMode = SCORING_MODES.LIVE_BEST) {
  const validSubs = Array.isArray(submissions) ? submissions.filter(Boolean) : [];
  
  if (validSubs.length === 0) {
    return {
      finalSubmission: null,
      finalScore: 0,
      bestScore: 0,
      latestScore: 0,
      totalSubmissions: 0,
      isOfficial: scoringMode !== SCORING_MODES.PRETEST
    };
  }

  // 1. Sort by submission time descending to find latest submission
  const byTimeDesc = [...validSubs].sort((a, b) => {
    const timeA = normalizeTimestamp(a.submittedAt || a.createdAt);
    const timeB = normalizeTimestamp(b.submittedAt || b.createdAt);
    if (timeB !== timeA) return timeB - timeA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
  const latestSub = byTimeDesc[0];

  // 2. Sort to find best submission:
  //    Primary: score descending
  //    Tie-breaker: submittedAt ascending (earlier submission has priority for stability)
  const byBest = [...validSubs].sort((a, b) => {
    const scoreA = Number(a.score) || 0;
    const scoreB = Number(b.score) || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const timeA = normalizeTimestamp(a.submittedAt || a.createdAt);
    const timeB = normalizeTimestamp(b.submittedAt || b.createdAt);
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const bestSub = byBest[0];

  let finalSub = null;
  if (scoringMode === SCORING_MODES.OLYMPIC_LATEST) {
    finalSub = latestSub;
  } else {
    // Both LIVE_BEST and PRETEST evaluate the best submission for the score
    finalSub = bestSub;
  }

  const finalScore = finalSub ? (Number(finalSub.score) || 0) : 0;
  const bestScore = bestSub ? (Number(bestSub.score) || 0) : 0;
  const latestScore = latestSub ? (Number(latestSub.score) || 0) : 0;

  return {
    finalSubmission: finalSub,
    finalScore,
    bestScore,
    latestScore,
    totalSubmissions: validSubs.length,
    isOfficial: scoringMode !== SCORING_MODES.PRETEST
  };
}

/**
 * Resolves the full contest result for a student across all contest problems.
 * @param {object} contest - Contest object containing scoringMode and problemIds
 * @param {Array} userSubmissions - Submissions by a single student for this contest
 * @returns {object} { scoringMode, isOfficial, totalScore, officialScore, problemsSolved, problemResults }
 */
function resolveContestFinalResult(contest, userSubmissions = []) {
  const scoringMode = contest?.scoringMode || SCORING_MODES.LIVE_BEST;
  const isOfficial = scoringMode !== SCORING_MODES.PRETEST;
  const problemIds = Array.isArray(contest?.problemIds) ? contest.problemIds : [];

  // Group submissions by problemId
  const subsByProblem = {};
  for (const sub of userSubmissions) {
    if (!sub || !sub.problemId) continue;
    if (!subsByProblem[sub.problemId]) subsByProblem[sub.problemId] = [];
    subsByProblem[sub.problemId].push(sub);
  }

  const allProblemIds = Array.from(new Set([...problemIds, ...Object.keys(subsByProblem)]));
  const problemResults = {};
  let totalScore = 0;
  let problemsSolved = 0;

  for (const pId of allProblemIds) {
    const pSubs = subsByProblem[pId] || [];
    const res = resolveProblemSubmission(pSubs, scoringMode);
    problemResults[pId] = res;
    totalScore += res.finalScore;
    if (res.finalSubmission?.status === 'AC') {
      problemsSolved++;
    }
  }

  return {
    scoringMode,
    isOfficial,
    totalScore,
    officialScore: isOfficial ? totalScore : 0,
    problemsSolved,
    problemResults
  };
}

module.exports = {
  SCORING_MODES,
  resolveProblemSubmission,
  resolveContestFinalResult
};
