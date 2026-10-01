const crypto = require('crypto');

class ContestPolicyError extends Error {
  constructor(code, message, status = 403) {
    super(message);
    this.name = 'ContestPolicyError';
    this.code = code;
    this.status = status;
  }
}

function pinsMatch(expected, supplied) {
  const left = Buffer.from(String(expected || ''), 'utf8');
  const right = Buffer.from(String(supplied || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function assertIdentityEligible(contest, user) {
  if (!contest) throw new ContestPolicyError('CONTEST_NOT_FOUND', 'Kỳ thi không tồn tại.', 404);
  if (!user || user.role !== 'user') throw new ContestPolicyError('STUDENT_REQUIRED', 'Chỉ tài khoản học sinh được tham gia kỳ thi.');
  if (user.isLocked) throw new ContestPolicyError('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa.');

  if (Array.isArray(contest.candidateIds) && contest.candidateIds.length > 0) {
    if (!contest.candidateIds.includes(user.id)) {
      throw new ContestPolicyError('NOT_A_CANDIDATE', 'Bạn không có tên trong danh sách thí sinh.');
    }
  } else if (Array.isArray(contest.classIds) && contest.classIds.length > 0 && !contest.classIds.includes(user.classId)) {
    throw new ContestPolicyError('CLASS_NOT_ELIGIBLE', 'Lớp của bạn không được tham gia kỳ thi này.');
  }
}

function effectiveEndTime(contest, attendance) {
  const end = new Date(contest.endTime).getTime();
  const extraMinutes = Math.max(0, Number(attendance?.extraMinutes) || 0);
  return end + extraMinutes * 60 * 1000;
}

function assertTimingAllowed(contest, attendance, now) {
  const start = new Date(contest.startTime).getTime();
  const end = effectiveEndTime(contest, attendance);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new ContestPolicyError('INVALID_CONTEST_TIME', 'Thời gian kỳ thi không hợp lệ.', 500);
  }
  if (now < start || contest.status === 'upcoming') {
    throw new ContestPolicyError('CONTEST_NOT_STARTED', 'Kỳ thi chưa bắt đầu.');
  }
  const manuallyReopened = !!attendance?.reopened;
  if (now > end || (contest.status === 'ended' && !manuallyReopened)) {
    throw new ContestPolicyError('CONTEST_ENDED', 'Kỳ thi đã kết thúc.');
  }
  if (attendance?.status === 'suspended') {
    throw new ContestPolicyError('PARTICIPATION_SUSPENDED', 'Lượt thi đã bị đình chỉ.');
  }
}

function assertJoinAllowed({ contest, user, suppliedPin = '', attendance = null, now = Date.now() }) {
  assertIdentityEligible(contest, user);
  assertTimingAllowed(contest, attendance, now);
  if (contest.pinCode && !pinsMatch(contest.pinCode, suppliedPin)) {
    throw new ContestPolicyError('INVALID_CONTEST_PIN', 'Mã PIN kỳ thi không đúng.');
  }
  return { effectiveEndTime: effectiveEndTime(contest, attendance) };
}

function assertSubmissionAllowed({ contest, user, attendance = null, now = Date.now(), joined, problemId }) {
  assertIdentityEligible(contest, user);
  if (!joined) {
    throw new ContestPolicyError('CONTEST_JOIN_REQUIRED', 'Bạn phải vào phòng thi trước khi nộp bài.');
  }
  assertTimingAllowed(contest, attendance, now);
  if (!Array.isArray(contest.problemIds) || !contest.problemIds.includes(problemId)) {
    throw new ContestPolicyError('PROBLEM_NOT_IN_CONTEST', 'Bài tập không thuộc kỳ thi này.');
  }
  return { effectiveEndTime: effectiveEndTime(contest, attendance) };
}

module.exports = {
  ContestPolicyError,
  assertJoinAllowed,
  assertSubmissionAllowed,
  effectiveEndTime
};
