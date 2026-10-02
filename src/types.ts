export type Role = 'host' | 'user';

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'QUEUED' | 'JUDGING';

export interface TestCase {
  id: string;
  name?: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isTrap?: boolean;
  score?: number;
}

export interface ProblemSample {
  id?: string;
  name?: string;
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  code: string;
  title: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Khó';
  points: number;
  timeLimit: number; // ms
  memoryLimit: number; // MB
  category: string;
  description: string;
  inputDescription?: string;
  outputDescription?: string;
  constraints?: string;
  statement?: string;
  statementHtml?: string;
  samples?: ProblemSample[];
  sampleCode?: string;
  pdfUrl?: string;
  pdfFileName?: string;
  testCases?: TestCase[]; // Kept on server, never sent to student
  testCount?: number;     // Total count of tests (shown to student)
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed' | 'modified';
  lineNo: number; // line number in expected or actual
  content: string;
  expectedContent?: string; // used when type === 'modified' (dòng lệch giá trị)
}

export interface TestResultDetail {
  testIndex: number;
  name?: string;
  status: Verdict;
  time: number;
  memory: number;
  isSample?: boolean;
  isTrap?: boolean;
  scoreEarned?: number;
  message?: string;
  input?: string;
  userOutput?: string;
  expectedOutput?: string;
  diff?: DiffLine[];       // populated on WA, shows first diverging lines
  diffTruncated?: boolean; // true if diff was capped (full diff needs expand)
}

export interface Submission {
  id: string;
  userId: string;
  userName: string;
  problemId: string;
  problemCode: string;
  code: string;
  status: Verdict;
  score: number;
  passedTests: number;
  totalTests: number;
  executionTime: number;
  memoryUsed: number;
  submittedAt: string;
  compileError?: string;
  details?: TestResultDetail[];
  contestId?: string;
  isVirtual?: boolean;
  participationType?: 'REAL' | 'VIRTUAL';
  virtualSessionId?: string;
}

export interface ContestReportRow {
  stt: number;
  fullName: string;
  className: string;
  score: number;
  problemsSolved?: number;
  totalSubmissions?: number;
  participationType: 'REAL' | 'VIRTUAL';
}

export interface ContestReport {
  contestId: string;
  contestTitle: string;
  startTime: string;
  endTime: string;
  totalScore: number;
  participantCount: number;
  rows: ContestReportRow[];
}

export interface VirtualSession {
  id: string;
  userId: string;
  userName: string;
  contestId: string;
  contestTitle: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'running' | 'completed';
  score?: number;
  problemsSolved?: number;
  totalSubmissions?: number;
  createdAt: string;
}

export type ScopeType = 'ALL' | 'GRADE' | 'CLASS' | 'STUDENT';

export interface Contest {
  id: string;
  title: string;
  description: string;
  mode: 'offline' | 'online'; // 'offline' = Mạng LAN phòng máy (Không cần Internet); 'online' = Trực tuyến qua Internet
  scopeType?: ScopeType;      // 'ALL' (Toàn trường) | 'GRADE' (Theo khối) | 'CLASS' (Theo lớp) | 'STUDENT' (Chỉ định học sinh)
  targetGrades?: number[];    // Danh sách khối áp dụng (vd: [6, 7])
  targetClasses?: string[];   // Danh sách ID/Tên lớp áp dụng
  targetStudents?: string[];  // Danh sách ID học sinh áp dụng
  totalScore?: number;        // Tổng điểm kỳ thi (mặc định 100, có thể cấu hình 10, 50...)
  classIds: string[];         // Lớp được tham gia ([] = tất cả, giữ đồng bộ với targetClasses)
  problemIds: string[];       // Danh sách ID/Code bài tập trong đề thi
  startTime: string;          // ISO string
  endTime: string;            // ISO string
  durationMinutes: number;    // Thời lượng làm bài (phút)
  status: 'upcoming' | 'running' | 'ended';
  gradingMode: 'direct' | 'batch_after_deadline'; // Chấm trực tiếp hay chấm sau khi hết giờ
  freezeScoreboardMinutes: number; // Đóng băng BXH trước khi hết giờ (phút)
  pinCode?: string;           // Mã PIN phòng thi
  requiresPin?: boolean;      // Server-safe signal; the PIN value is never returned to students
  antiCheat: {
    preventTabSwitch: boolean;
    maxTabViolations: number;
    preventCopyPaste: boolean;
  };
  createdAt: string;
  pdfUrl?: string;
  pdfFileName?: string;
  statementHtml?: string;     // HTML nội dung đề thi (tự động chuyển từ docx/md)
  problems?: Problem[];
  candidateIds?: string[];    // Danh sách học sinh chỉ định (giữ đồng bộ với targetStudents)
  hideTestDetailsForStudents?: boolean; // Ẩn chi tiết input/output đối với thí sinh
  requireFreopen?: boolean;   // Bắt buộc dùng freopen("<tenbai>.inp", "r", stdin) và freopen("<tenbai>.out", "w", stdout)
  ipWhitelist?: string;       // Dải IP hoặc danh sách IP hợp lệ được phép thi (vd: 192.168.1.* hoặc 192.168.1.1-192.168.1.50)
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  classId: string;            // Lớp chính (backward compatibility)
  classes?: string[];         // Danh sách tất cả các lớp/nhóm mà học sinh tham gia (N:N)
  streak?: number;
  badges?: string[];
  isLocked?: boolean;
  mustChangePassword?: boolean;
}

export type AttendanceStatus = 'present' | 'absent_excused' | 'absent_unexcused' | 'submitted' | 'suspended';

export interface StudentAttendance {
  userId: string;
  username: string;
  fullName: string;
  classId: string;
  status: AttendanceStatus;
  extraMinutes: number;
  reason?: string;
  ip?: string;
  isOnline?: boolean;
  lastActive?: string;
  submissionsCount?: number;
  currentScore?: number;
}

export interface UserExamRecord {
  contestId: string;
  contestTitle: string;
  date: string;
  score: number;
  rank: number;
  totalParticipants: number;
  problemsSolved: number;
  totalProblems: number;
  status: AttendanceStatus;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade?: number;             // Khối lớp (vd: 6, 7, 8, 9, 10, 11, 12)
  teacher: string;
  joinCode: string;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  username: string;
  classId: string;
  totalScore: number;
  problemsSolved: number;
  totalSubmissions: number;
  solvedProblems: Record<string, { score: number; status: Verdict; time: number }>;
  badges: string[];
}

export interface DiagnosticsInfo {
  hasDocker: boolean;
  dockerVersion: string;
  hasGpp: boolean;
  gppPath: string;
  gppVersion: string;
  platform: string;
  localIps: Array<{ name: string; address: string; netmask: string }>;
  queue: {
    length: number;
    activeWorkers: number;
    concurrency: number;
  };
  settings: {
    serverName: string;
    port: number;
    compilerPath: string;
    useDocker: boolean;
    dockerImage: string;
    contestMode: boolean;
    contestEndTime: string | null;
    freezeScoreboard: boolean;
    allowCustomRun: boolean;
    submissionMode?: 'direct' | 'batch';
    submissionsClosed?: boolean;
  };
}

export interface DiscoveredServer {
  app: string;
  name: string;
  ip: string;
  allIps: string[];
  port: number;
  discoveredIp: string;
  lastSeen: number;
}

export interface BatchGradeProgress {
  total: number;
  done: number;
  success: number;
  errors: number;
  currentUser?: string;
  currentProblem?: string;
  cancelled?: boolean;
  finished?: boolean;
  errorList?: Array<{ submissionId: string; userName: string; problemCode?: string; error: string; status?: Verdict }>;
}
