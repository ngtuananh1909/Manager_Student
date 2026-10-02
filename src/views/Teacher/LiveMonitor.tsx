import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { Submission, BatchGradeProgress, Contest, Problem } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { DiffViewer } from '../../components/DiffViewer';
import { 
  Activity, 
  Code, 
  RefreshCw, 
  X, 
  Check, 
  Copy, 
  PlayCircle, 
  StopCircle, 
  CheckCircle2, 
  AlertCircle, 
  ListChecks,
  Lock, 
  Unlock, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  FileText, 
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  User as UserIcon,
  Clock,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
  Eye
} from 'lucide-react';

interface LiveProgress {
  currentTest: number;
  totalTests: number;
  lastTestStatus?: string;
  lastTestTime?: number;
  lastTestMemory?: number;
  details?: Array<{
    testIndex: number;
    name: string;
    status: string;
    time?: number;
    memory?: number;
  }>;
  message?: string;
}

interface StudentRow {
  userId: string;
  userName: string;
  fullName: string;
  className: string;
  isOnline: boolean;
  ip?: string;
  status: 'IN_PROGRESS' | 'LEFT' | 'COMPLETED' | 'NOT_STARTED';
  totalScore: number;
  maxPossibleScore: number;
  solvedCount: number;
  submittedCount: number;
  totalProblems: number;
  currentJudgingProblem?: string;
  warningsCount: number;
  lastActivityTime?: string;
  problems: Array<{
    problemId: string;
    code: string;
    title: string;
    points: number;
    bestSubmission: Submission | null;
    latestSubmission: Submission | null;
    submissionCount: number;
    isJudging: boolean;
    judgingProgress?: LiveProgress | null;
  }>;
}

export const LiveMonitor: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  
  // Base data states
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('all');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [virtualSessions, setVirtualSessions] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<{ queueLength: number; activeWorkers: number }>({ queueLength: 0, activeWorkers: 0 });
  const [liveProgressMap, setLiveProgressMap] = useState<Record<string, LiveProgress>>({});

  // Hierarchy expand states
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());
  const [expandedProblemKeys, setExpandedProblemKeys] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'in_progress' | 'left' | 'judging' | 'submitted' | 'completed' | 'warning'>('all');
  const [problemFilter, setProblemFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score_desc' | 'score_asc' | 'judging' | 'recent' | 'warnings'>('judging');

  // Submission modal state
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [modalTab, setModalTab] = useState<'tests' | 'code'>('tests');
  const [expandedWAIndices, setExpandedWAIndices] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  // Settings & submission mode state
  const [submissionsClosed, setSubmissionsClosed] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'direct' | 'batch'>('direct');

  // Batch grading state
  const [batchProgress, setBatchProgress] = useState<BatchGradeProgress | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchFilter, setBatchFilter] = useState<'queued' | 'all'>('queued');
  const [showBatchSummary, setShowBatchSummary] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchContests();
    fetchProblems();
    fetchSubmissions();
    fetchSettings();
  }, [serverUrl]);

  // When contest selection changes, fetch attendance & virtual sessions
  useEffect(() => {
    if (selectedContestId && selectedContestId !== 'all') {
      fetchContestAttendance(selectedContestId);
      fetchContestVirtualSessions(selectedContestId);
    } else {
      setAttendanceList([]);
      setVirtualSessions([]);
    }
  }, [selectedContestId, serverUrl]);

  // Socket.IO realtime listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('submission:created', (newSub: Submission) => {
      setSubmissions(prev => [newSub, ...prev]);
    });

    socket.on('submission:update', (data: { id: string; status: any }) => {
      setSubmissions(prev => prev.map(s => s.id === data.id ? { ...s, status: data.status } : s));
    });

    socket.on('submission:progress', (data: { id: string; currentTest: number; totalTests: number; lastTestStatus?: string; lastTestTime?: number; lastTestMemory?: number; details?: any[]; message?: string }) => {
      setLiveProgressMap(prev => ({
        ...prev,
        [data.id]: {
          currentTest: data.currentTest,
          totalTests: data.totalTests,
          lastTestStatus: data.lastTestStatus,
          lastTestTime: data.lastTestTime,
          lastTestMemory: data.lastTestMemory,
          details: data.details,
          message: data.message
        }
      }));
    });

    socket.on('submission:finished', (finishedSub: Submission) => {
      setSubmissions(prev => prev.map(s => s.id === finishedSub.id ? finishedSub : s));
      setSelectedSub(prev => prev && prev.id === finishedSub.id ? finishedSub : prev);
      setLiveProgressMap(prev => {
        const next = { ...prev };
        delete next[finishedSub.id];
        return next;
      });
    });

    socket.on('queue:status', (status: any) => {
      setQueueStatus(status);
    });

    socket.on('settings:update', (newSettings: any) => {
      if (newSettings.submissionsClosed !== undefined) setSubmissionsClosed(newSettings.submissionsClosed);
      if (newSettings.submissionMode !== undefined) setSubmissionMode(newSettings.submissionMode);
    });

    socket.on('contest:attendance_changed', () => {
      if (selectedContestId && selectedContestId !== 'all') {
        fetchContestAttendance(selectedContestId);
      }
    });

    socket.on('virtual_session:updated', (vs: any) => {
      setVirtualSessions(prev => {
        const idx = prev.findIndex(item => item.id === vs.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = vs;
          return next;
        }
        return [vs, ...prev];
      });
    });

    socket.on('batch:grade:progress', (progress: BatchGradeProgress) => {
      setBatchProgress(progress);
      if (progress.finished || progress.cancelled) {
        setBatchRunning(false);
        setShowBatchSummary(true);
        fetchSubmissions();
      }
    });

    return () => {
      socket.off('submission:created');
      socket.off('submission:update');
      socket.off('submission:progress');
      socket.off('submission:finished');
      socket.off('queue:status');
      socket.off('settings:update');
      socket.off('contest:attendance_changed');
      socket.off('virtual_session:updated');
      socket.off('batch:grade:progress');
    };
  }, [socket, selectedContestId]);

  const fetchContests = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/contests`);
      if (res.ok) {
        const list = await res.json();
        setContests(list);
      }
    } catch (e) {}
  };

  const fetchProblems = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/problems`);
      if (res.ok) setProblems(await res.json());
    } catch (e) {}
  };

  const fetchSubmissions = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/submissions`);
      if (res.ok) setSubmissions(await res.json());
    } catch (e) {}
  };

  const fetchContestAttendance = async (contestId: string) => {
    try {
      const res = await apiFetch(`${serverUrl}/api/contests/${contestId}/attendance`);
      if (res.ok) setAttendanceList(await res.json());
    } catch (e) {}
  };

  const fetchContestVirtualSessions = async (contestId: string) => {
    try {
      const res = await apiFetch(`${serverUrl}/api/contests/${contestId}/virtual-sessions`);
      if (res.ok) setVirtualSessions(await res.json());
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/diagnostics`);
      if (res.ok) {
        const diag = await res.json();
        if (diag.settings) {
          setSubmissionsClosed(!!diag.settings.submissionsClosed);
          setSubmissionMode(diag.settings.submissionMode || 'direct');
        }
      }
    } catch (e) {}
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSubmission = (sub: Submission) => {
    setSelectedSub(sub);
    setModalTab('tests');
    if (sub.details) {
      const firstWA = sub.details.findIndex(d => d.status === 'WA');
      setExpandedWAIndices(new Set(firstWA !== -1 ? [firstWA] : []));
    } else {
      setExpandedWAIndices(new Set());
    }
  };

  const handleToggleSubmissionPortal = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/submissions/toggle-close`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSubmissionsClosed(data.submissionsClosed);
      }
    } catch (e: any) {
      alert('Không thể thay đổi trạng thái cổng nộp bài: ' + e.message);
    }
  };

  const handleBatchGrade = async () => {
    if (batchRunning) return;
    const regrade = batchFilter === 'all';
    setBatchRunning(true);
    setShowBatchSummary(false);
    setBatchProgress({ total: 0, done: 0, success: 0, errors: 0 });
    try {
      const res = await apiFetch(`${serverUrl}/api/grade-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regrade, contestId: selectedContestId !== 'all' ? selectedContestId : undefined })
      });
      const data = await res.json();
      if (data.total === 0) {
        setBatchRunning(false);
        alert(data.message || 'Không có bài nộp nào cần chấm.');
      }
    } catch (e: any) {
      setBatchRunning(false);
      alert('Không thể kết nối máy chủ: ' + e.message);
    }
  };

  const handleCancelBatch = async () => {
    try {
      await apiFetch(`${serverUrl}/api/grade-all/cancel`, { method: 'DELETE' });
    } catch (e) {}
  };

  // ── ACTIVE CONTEST OBJECT & PROBLEMS ──
  const activeContest = useMemo(() => {
    if (selectedContestId === 'all') return null;
    return contests.find(c => c.id === selectedContestId) || null;
  }, [contests, selectedContestId]);

  const activeContestProblems = useMemo(() => {
    if (activeContest) {
      const pIds = activeContest.problemIds || [];
      return pIds.map(pId => problems.find(p => p.id === pId || p.code === pId)).filter(Boolean) as Problem[];
    }
    return problems;
  }, [activeContest, problems]);

  // ── SUBMISSIONS FILTERED BY SELECTED CONTEST ──
  const contestSubmissions = useMemo(() => {
    if (selectedContestId === 'all') return submissions;
    return submissions.filter(s => s.contestId === selectedContestId);
  }, [submissions, selectedContestId]);

  // ── HIERARCHICAL STUDENT AGGREGATION (TẦNG 2 & TẦNG 3) ──
  const studentsList: StudentRow[] = useMemo(() => {
    // Collect all unique students associated with this contest or submissions
    const studentMap = new Map<string, {
      userId: string;
      userName: string;
      fullName: string;
      className: string;
      isOnline: boolean;
      ip?: string;
      status: 'IN_PROGRESS' | 'LEFT' | 'COMPLETED' | 'NOT_STARTED';
      warningsCount: number;
      lastActivityTime?: string;
    }>();

    // 1. From attendance list
    for (const att of attendanceList) {
      if (!att.userId) continue;
      studentMap.set(att.userId, {
        userId: att.userId,
        userName: att.username || att.userId,
        fullName: att.fullName || att.name || att.username || att.userId,
        className: att.className || att.class || '',
        isOnline: !!att.isOnline,
        ip: att.ip || '',
        status: att.status === 'suspended' ? 'COMPLETED' : (att.isOnline ? 'IN_PROGRESS' : 'LEFT'),
        warningsCount: Number(att.tabViolations || att.warningsCount || 0),
        lastActivityTime: att.lastActiveAt || att.updatedAt
      });
    }

    // 2. From virtual sessions
    for (const vs of virtualSessions) {
      if (!vs.userId) continue;
      const existing = studentMap.get(vs.userId);
      const vsStatusMap: Record<string, 'IN_PROGRESS' | 'LEFT' | 'COMPLETED' | 'NOT_STARTED'> = {
        running: 'IN_PROGRESS',
        left: 'LEFT',
        completed: 'COMPLETED',
        timeout: 'COMPLETED',
        not_started: 'NOT_STARTED'
      };
      const vStatus = vsStatusMap[vs.status] || 'IN_PROGRESS';
      if (!existing) {
        studentMap.set(vs.userId, {
          userId: vs.userId,
          userName: vs.userName || vs.userId,
          fullName: vs.userName || vs.userId,
          className: '',
          isOnline: vs.status === 'running',
          ip: '',
          status: vStatus,
          warningsCount: 0,
          lastActivityTime: vs.lastActiveAt || vs.createdAt
        });
      } else {
        existing.status = vStatus;
        if (vs.lastActiveAt) existing.lastActivityTime = vs.lastActiveAt;
      }
    }

    // 3. From contest submissions (Rule 45: Deduplicate by userId)
    for (const sub of contestSubmissions) {
      if (!sub.userId) continue;
      if (!studentMap.has(sub.userId)) {
        studentMap.set(sub.userId, {
          userId: sub.userId,
          userName: sub.userName || sub.userId,
          fullName: sub.userFullName || sub.userName || sub.userId,
          className: sub.className || '',
          isOnline: false,
          ip: sub.ip || '',
          status: 'IN_PROGRESS',
          warningsCount: 0,
          lastActivityTime: sub.createdAt || sub.submittedAt
        });
      } else {
        const s = studentMap.get(sub.userId)!;
        if (!s.className && sub.className) s.className = sub.className;
        if (!s.fullName && (sub.userFullName || sub.userName)) s.fullName = sub.userFullName || sub.userName;
        const subTime = sub.createdAt || sub.submittedAt;
        if (subTime && (!s.lastActivityTime || new Date(subTime).getTime() > new Date(s.lastActivityTime).getTime())) {
          s.lastActivityTime = subTime;
        }
      }
    }

    // Compute problems & score per student
    const result: StudentRow[] = [];
    const targetProbs = activeContestProblems;
    const maxContestScore = targetProbs.reduce((sum, p) => sum + (p.points || 100), 0) || 100;

    for (const [userId, base] of studentMap.entries()) {
      const studentSubs = contestSubmissions.filter(s => s.userId === userId);
      
      let totalEarnedScore = 0;
      let solvedCount = 0;
      let submittedCount = 0;
      let currentJudgingProblem: string | undefined = undefined;

      const problemRows = targetProbs.map(prob => {
        const probSubs = studentSubs.filter(s => s.problemId === prob.id || s.problemCode?.toUpperCase() === prob.code.toUpperCase());
        const bestSub = probSubs.reduce((best, cur) => ((cur.score || 0) > (best?.score || 0) ? cur : best), null as Submission | null);
        const latestSub = probSubs.length > 0 ? probSubs[0] : null;

        if (probSubs.length > 0) submittedCount++;
        if (bestSub && (bestSub.status === 'AC' || (bestSub.score || 0) >= (prob.points || 100))) {
          solvedCount++;
        }
        totalEarnedScore += (bestSub?.score || 0);

        const isJudging = probSubs.some(s => s.status === 'JUDGING' || s.status === 'QUEUED' || s.status === 'COMPILING');
        const judgingSub = probSubs.find(s => s.status === 'JUDGING' || s.status === 'QUEUED' || s.status === 'COMPILING');
        if (isJudging && !currentJudgingProblem) {
          currentJudgingProblem = prob.code;
        }

        const judgingProgress = judgingSub ? liveProgressMap[judgingSub.id] : null;

        return {
          problemId: prob.id,
          code: prob.code,
          title: prob.title,
          points: prob.points || 100,
          bestSubmission: bestSub,
          latestSubmission: latestSub,
          submissionCount: probSubs.length,
          isJudging,
          judgingProgress
        };
      });

      result.push({
        ...base,
        totalScore: Math.round(totalEarnedScore * 10) / 10,
        maxPossibleScore: maxContestScore,
        solvedCount,
        submittedCount,
        totalProblems: targetProbs.length,
        currentJudgingProblem,
        problems: problemRows
      });
    }

    return result;
  }, [activeContestProblems, contestSubmissions, attendanceList, virtualSessions, liveProgressMap]);

  // ── FILTERED & SORTED STUDENTS ──
  const filteredStudents = useMemo(() => {
    return studentsList.filter(student => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = student.fullName.toLowerCase().includes(q) || student.userName.toLowerCase().includes(q);
        const matchClass = student.className.toLowerCase().includes(q);
        if (!matchName && !matchClass) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'online' && !student.isOnline) return false;
      if (statusFilter === 'offline' && student.isOnline) return false;
      if (statusFilter === 'in_progress' && student.status !== 'IN_PROGRESS') return false;
      if (statusFilter === 'left' && student.status !== 'LEFT') return false;
      if (statusFilter === 'completed' && student.status !== 'COMPLETED') return false;
      if (statusFilter === 'judging' && !student.currentJudgingProblem) return false;
      if (statusFilter === 'submitted' && student.submittedCount === 0) return false;
      if (statusFilter === 'warning' && student.warningsCount === 0) return false;

      // 3. Problem Filter
      if (problemFilter !== 'all') {
        const hasProb = student.problems.some(p => (p.problemId === problemFilter || p.code === problemFilter) && p.submissionCount > 0);
        if (!hasProb) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.fullName.localeCompare(b.fullName, 'vi');
      if (sortBy === 'score_desc') return b.totalScore - a.totalScore;
      if (sortBy === 'score_asc') return a.totalScore - b.totalScore;
      if (sortBy === 'judging') {
        if (a.currentJudgingProblem && !b.currentJudgingProblem) return -1;
        if (!a.currentJudgingProblem && b.currentJudgingProblem) return 1;
        return b.totalScore - a.totalScore;
      }
      if (sortBy === 'warnings') return b.warningsCount - a.warningsCount;
      if (sortBy === 'recent') {
        const timeA = a.lastActivityTime ? new Date(a.lastActivityTime).getTime() : 0;
        const timeB = b.lastActivityTime ? new Date(b.lastActivityTime).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
  }, [studentsList, searchQuery, statusFilter, problemFilter, sortBy]);

  // ── DASHBOARD COUNTERS (TẦNG 1) ──
  const dashboardStats = useMemo(() => {
    const totalStudents = studentsList.length;
    const onlineCount = studentsList.filter(s => s.isOnline).length;
    const offlineCount = totalStudents - onlineCount;
    const inProgressCount = studentsList.filter(s => s.status === 'IN_PROGRESS').length;
    const judgingCount = studentsList.filter(s => !!s.currentJudgingProblem).length;
    const submittedCount = studentsList.filter(s => s.submittedCount > 0).length;

    return {
      totalStudents,
      onlineCount,
      offlineCount,
      inProgressCount,
      judgingCount,
      submittedCount
    };
  }, [studentsList]);

  // Toggle helpers
  const toggleStudentExpand = (userId: string) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleProblemExpand = (key: string) => {
    setExpandedProblemKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedStudentIds(new Set(filteredStudents.map(s => s.userId)));
  };

  const collapseAll = () => {
    setExpandedStudentIds(new Set());
    setExpandedProblemKeys(new Set());
  };

  return (
    <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} style={{ color: 'var(--accent-emerald)' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              Giám Sát Chấm Bài Realtime
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
            Kiến trúc 4 tầng: Kỳ thi → Thí sinh → Bài tập → Chi tiết từng Testcase chấm điểm trực tiếp
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>HÀNG ĐỢI:</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {queueStatus.queueLength} bài
            </span>
          </div>
          <div className="glass-card" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>WORKERS:</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {queueStatus.activeWorkers} / 2
            </span>
          </div>
          <button 
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              fetchSubmissions();
              if (selectedContestId !== 'all') {
                fetchContestAttendance(selectedContestId);
                fetchContestVirtualSessions(selectedContestId);
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={13} /> Làm Mới
          </button>
        </div>
      </div>

      {/* ── TẦNG 1: CHỌN KỲ THI & DASHBOARD TỔNG QUAN ── */}
      <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TẦNG 1: KỲ THI
            </span>
            <select
              className="input-field"
              value={selectedContestId}
              onChange={e => setSelectedContestId(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.9rem', padding: '6px 12px', minWidth: '280px', color: 'var(--accent-cyan)' }}
            >
              <option value="all">── Tất cả kỳ thi & phòng thi ──</option>
              {contests.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.mode === 'offline' ? 'Offline LAN' : 'Online'} • {c.status === 'running' ? 'Đang thi' : 'Đã kết thúc'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Portal Toggle & Batch Grade Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleToggleSubmissionPortal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: submissionsClosed ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${submissionsClosed ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)'}`,
                color: submissionsClosed ? '#f87171' : '#34d399',
                fontWeight: 600
              }}
              title="Đóng hoặc mở cổng nộp bài"
            >
              {submissionsClosed ? <Lock size={13} /> : <Unlock size={13} />}
              {submissionsClosed ? 'Cổng: ĐÃ ĐÓNG' : 'Cổng: ĐANG MỞ'}
            </button>

            {batchRunning ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancelBatch}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', fontWeight: 700 }}
              >
                <StopCircle size={14} /> Dừng Chấm
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBatchGrade}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', fontWeight: 700 }}
                title="Chấm lại các bài nộp trong kỳ thi"
              >
                <PlayCircle size={14} /> Chấm Hàng Loạt
              </button>
            )}
          </div>
        </div>

        {/* Dashboard 6 Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG THÍ SINH</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.totalStudents}
            </div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>🟢 ONLINE</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.onlineCount}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>⚪ OFFLINE</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.offlineCount}
            </div>
          </div>

          <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>🏃 ĐANG THI</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.inProgressCount}
            </div>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', fontWeight: 600 }}>🟡 ĐANG CHẤM</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.judgingCount}
            </div>
          </div>

          <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.25)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 600 }}>📤 ĐÃ NỘP BÀI</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c7d2fe', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
              {dashboardStats.submittedCount}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER, SEARCH & SORT TOOLBAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm theo họ tên, lớp, tài khoản..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '0.82rem', height: '32px' }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ fontSize: '0.8rem', padding: '4px 8px', height: '32px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="online">🟢 Đang Online</option>
              <option value="offline">⚪ Đang Offline</option>
              <option value="in_progress">🏃 Đang thi</option>
              <option value="left">🚪 Đã rời màn hình</option>
              <option value="judging">🟡 Đang chấm</option>
              <option value="submitted">📤 Đã nộp bài</option>
              <option value="completed">✓ Đã kết thúc</option>
              <option value="warning">⚠ Có cảnh báo rời tab</option>
            </select>
          </div>

          {/* Problem Filter */}
          <select
            className="input-field"
            value={problemFilter}
            onChange={e => setProblemFilter(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '4px 8px', height: '32px', maxWidth: '160px' }}
          >
            <option value="all">Tất cả bài</option>
            {activeContestProblems.map(p => (
              <option key={p.id} value={p.id}>Bài {p.code}</option>
            ))}
          </select>
        </div>

        {/* Sort & Expand Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input-field"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{ fontSize: '0.8rem', padding: '4px 8px', height: '32px' }}
            >
              <option value="judging">Ưu tiên đang chấm</option>
              <option value="score_desc">Điểm cao → thấp</option>
              <option value="score_asc">Điểm thấp → cao</option>
              <option value="name">Tên A → Z</option>
              <option value="warnings">Nhiều cảnh báo trước</option>
              <option value="recent">Hoạt động gần nhất</option>
            </select>
          </div>

          <button 
            type="button" 
            className="btn btn-outline btn-sm" 
            onClick={expandAll}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Mở Tất Cả
          </button>
          <button 
            type="button" 
            className="btn btn-outline btn-sm" 
            onClick={collapseAll}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            Thu Gọn
          </button>
        </div>
      </div>

      {/* ── TẦNG 2 & 3 & 4: DANH SÁCH THÍ SINH & BÀI THI & TESTCASE ── */}
      {filteredStudents.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <UserIcon size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
            Không tìm thấy thí sinh phù hợp
          </div>
          <p style={{ fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto' }}>
            Hãy thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại bộ lọc trạng thái phía trên.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredStudents.map(student => {
            const isExpanded = expandedStudentIds.has(student.userId);
            const statusColor = student.status === 'IN_PROGRESS' ? 'var(--accent-emerald)'
              : student.status === 'LEFT' ? 'var(--accent-amber)'
              : student.status === 'COMPLETED' ? '#818cf8' : 'var(--text-muted)';
            const statusLabel = student.status === 'IN_PROGRESS' ? 'Đang thi'
              : student.status === 'LEFT' ? 'Đã rời màn hình'
              : student.status === 'COMPLETED' ? 'Đã kết thúc' : 'Chưa bắt đầu';

            return (
              <div 
                key={student.userId} 
                className="glass-panel"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${student.currentJudgingProblem ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)'}`,
                  background: student.currentJudgingProblem ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-surface)',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* ── TẦNG 2: THÍ SINH ROW HEADER ── */}
                <div 
                  onClick={() => toggleStudentExpand(student.userId)}
                  style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '14px',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Left: Expand Arrow, Name, Class, Online dot */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {isExpanded ? <ChevronDown size={18} color="var(--accent-cyan)" /> : <ChevronRight size={18} />}
                    </button>

                    {/* Online indicator */}
                    <span 
                      style={{
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        background: student.isOnline ? '#10b981' : '#64748b',
                        boxShadow: student.isOnline ? '0 0 8px #10b981' : 'none',
                        display: 'inline-block'
                      }}
                      title={student.isOnline ? `Online (IP: ${student.ip || 'LAN'})` : 'Offline'}
                    />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          {student.fullName}
                        </span>
                        {student.className && (
                          <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)', fontSize: '0.72rem', fontWeight: 700 }}>
                            {student.className}
                          </span>
                        )}
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          @{student.userName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center & Right: Exam Status, Score, Progress, Warnings */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Judging Indicator if currently judging */}
                    {student.currentJudgingProblem && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <RefreshCw size={11} className="animate-spin" /> Đang chấm bài {student.currentJudgingProblem}
                      </span>
                    )}

                    {/* Warnings Badge */}
                    {student.warningsCount > 0 && (
                      <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={11} /> ⚠ {student.warningsCount} cảnh báo rời tab
                      </span>
                    )}

                    {/* Status Pill */}
                    <span 
                      className="badge" 
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        color: statusColor, 
                        border: `1px solid ${statusColor}44`,
                        fontSize: '0.74rem',
                        fontWeight: 700
                      }}
                    >
                      {statusLabel}
                    </span>

                    {/* Total Score */}
                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                        {student.totalScore}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        /{student.maxPossibleScore}đ
                      </span>
                    </div>

                    {/* Problems solved chip */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '3px 8px', borderRadius: '4px' }}>
                      {student.solvedCount}/{student.totalProblems} bài đạt
                    </div>
                  </div>
                </div>

                {/* ── TẦNG 3: CÁC BÀI CỦA THÍ SINH (EXPANDED) ── */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(0, 0, 0, 0.2)', padding: '14px 18px 18px 24px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      TẦNG 3: DANH SÁCH BÀI CỦA THÍ SINH
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {student.problems.map((prob, pIdx) => {
                        const probKey = `${student.userId}_${prob.problemId}`;
                        const isProblemExpanded = expandedProblemKeys.has(probKey);
                        const bestSub = prob.bestSubmission;
                        const latestSub = prob.latestSubmission;
                        const isJudging = prob.isJudging;
                        const liveProg = prob.judgingProgress;

                        const testDetails = liveProg?.details || bestSub?.details || latestSub?.details || [];

                        return (
                          <div 
                            key={prob.problemId}
                            style={{
                              background: 'var(--bg-surface-elevated)',
                              borderRadius: '6px',
                              border: `1px solid ${isJudging ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)'}`,
                              padding: '10px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                              {/* Problem Title & Code */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                  {pIdx === student.problems.length - 1 ? '└──' : '├──'}
                                </span>
                                <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
                                  [{prob.code}]
                                </strong>
                                <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                                  {prob.title}
                                </span>
                              </div>

                              {/* Problem Status, Score & Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Live Progress bar if judging */}
                                {isJudging && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw size={12} className="animate-spin" color="var(--accent-amber)" />
                                    <span style={{ fontSize: '0.76rem', color: 'var(--accent-amber)', fontWeight: 700 }}>
                                      {liveProg ? `Đang chấm test ${liveProg.currentTest}/${liveProg.totalTests}` : 'Đang biên dịch / chấm bài...'}
                                    </span>
                                  </div>
                                )}

                                {/* Best Verdict */}
                                {bestSub ? (
                                  <VerdictBadge status={bestSub.status} size="sm" />
                                ) : (
                                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Chưa nộp</span>
                                )}

                                {/* Score */}
                                <div style={{ minWidth: '70px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}>
                                  <strong style={{ color: bestSub ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                                    {bestSub ? bestSub.score : 0}
                                  </strong>
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>/{prob.points}đ</span>
                                </div>

                                {/* Run Time & Memory */}
                                {bestSub && (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {bestSub.executionTime || 0}ms • {bestSub.memoryUsed || 0}MB
                                  </span>
                                )}

                                {/* Submissions Count */}
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '3px' }}>
                                  {prob.submissionCount} lần nộp
                                </span>

                                {/* Toggle Testcases Button (TẦNG 4) */}
                                {testDetails.length > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => toggleProblemExpand(probKey)}
                                    style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    {isProblemExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    {isProblemExpanded ? 'Ẩn test' : `Xem ${testDetails.length} testcase`}
                                  </button>
                                )}

                                {/* Inspect Latest Submission Modal */}
                                {(bestSub || latestSub) && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleOpenSubmission((bestSub || latestSub)!)}
                                    style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    title="Xem code và toàn bộ testcase"
                                  >
                                    <Eye size={12} /> Code & Diff
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* ── TẦNG 4: TESTCASES CHI TIẾT (EXPANDED) ── */}
                            {isProblemExpanded && testDetails.length > 0 && (
                              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.25)', borderRadius: '4px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={12} /> TẦNG 4: CHI TIẾT TỪNG TEST CASE CHẤM ĐIỂM ({testDetails.length} tests)
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                                  {testDetails.map((tc, tcIdx) => {
                                    const isAC = tc.status === 'AC';
                                    const isWA = tc.status === 'WA';
                                    const isTLE = tc.status === 'TLE';
                                    const isTesting = tc.status === 'TESTING';

                                    const badgeColor = isAC ? '#10b981'
                                      : isWA ? '#ef4444'
                                      : isTLE ? '#f59e0b'
                                      : isTesting ? '#38bdf8' : '#a855f7';

                                    return (
                                      <div 
                                        key={tcIdx}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: '4px',
                                          background: 'var(--bg-app)',
                                          border: `1px solid ${badgeColor}33`,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          fontSize: '0.72rem'
                                        }}
                                      >
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                          Test {String(tc.testIndex || tcIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span 
                                          style={{ 
                                            fontWeight: 800, 
                                            color: badgeColor,
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.74rem'
                                          }}
                                        >
                                          {tc.status || 'Chờ'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: CHI TIẾT BÀI NỘP, DIFF & SOURCE CODE ── */}
      {selectedSub && (
        <div className="modal-overlay" onClick={() => setSelectedSub(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                    Chi Tiết Bài Nộp: {selectedSub.problemCode}
                  </h3>
                  <VerdictBadge status={selectedSub.status} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                    {selectedSub.score} điểm
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Thí sinh: <strong>{selectedSub.userFullName || selectedSub.userName}</strong> • {new Date(selectedSub.createdAt || selectedSub.submittedAt || Date.now()).toLocaleString('vi-VN')}
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setSelectedSub(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="linear-tabs" style={{ marginBottom: '14px' }}>
              <button 
                type="button" 
                className={`linear-tab-btn ${modalTab === 'tests' ? 'active' : ''}`}
                onClick={() => setModalTab('tests')}
              >
                Kết Quả Test Cases ({selectedSub.details?.length || 0})
              </button>
              <button 
                type="button" 
                className={`linear-tab-btn ${modalTab === 'code' ? 'active' : ''}`}
                onClick={() => setModalTab('code')}
              >
                Mã Nguồn Thí Sinh
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {modalTab === 'tests' ? (
                <div>
                  {selectedSub.compileError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                      <strong style={{ color: '#ef4444', fontSize: '0.82rem' }}>LỖI BIÊN DỊCH (COMPILE ERROR):</strong>
                      <pre style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                        {selectedSub.compileError}
                      </pre>
                    </div>
                  )}

                  {(!selectedSub.details || selectedSub.details.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Không có thông tin chi tiết testcase.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedSub.details.map((tc, idx) => {
                        const isExpanded = expandedWAIndices.has(idx);
                        return (
                          <div 
                            key={idx}
                            style={{
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '10px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                  Test {String(tc.testIndex || idx + 1).padStart(2, '0')}: {tc.name}
                                </span>
                                <VerdictBadge status={tc.status} size="sm" />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  {tc.time || 0}ms • {tc.memory || 0}MB
                                </span>
                                {tc.diff && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setExpandedWAIndices(prev => {
                                      const next = new Set(prev);
                                      next.has(idx) ? next.delete(idx) : next.add(idx);
                                      return next;
                                    })}
                                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                  >
                                    {isExpanded ? 'Ẩn Diff' : 'Xem Diff'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Diff Viewer for WA */}
                            {isExpanded && tc.diff && (
                              <div style={{ marginTop: '10px' }}>
                                <DiffViewer diff={tc.diff} truncated={tc.diffTruncated} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => copyCode(selectedSub.code || '')}
                    style={{ position: 'absolute', right: '10px', top: '10px', zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copied ? 'Đã chép' : 'Sao chép'}
                  </button>
                  <pre style={{
                    background: '#090d16',
                    padding: '16px',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.84rem',
                    lineHeight: '1.6',
                    overflowX: 'auto',
                    margin: 0
                  }}>
                    {selectedSub.code || '(Không có mã nguồn)'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
