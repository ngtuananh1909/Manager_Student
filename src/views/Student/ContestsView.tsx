import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Contest, Problem, Submission, VirtualSession, LeaderboardEntry } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { useAuth } from '../../context/AuthContext';
import { ProblemDetail } from './ProblemDetail';
import { VerdictBadge } from '../../components/VerdictBadge';
import { StatementViewer } from '../../components/StatementViewer';
import { 
  Trophy, 
  Wifi, 
  Globe, 
  Clock, 
  Play, 
  ArrowLeft, 
  Timer, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Calendar,
  Lock,
  ChevronRight,
  FileCheck,
  RotateCcw,
  BarChart3,
  X,
  Sparkles,
  Award,
  FileText,
  Download,
  Eye,
  RefreshCw
} from 'lucide-react';

export const ContestsView: React.FC = () => {
  const { serverUrl, socket, getServerNow } = useNetwork();
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewingContestPdf, setViewingContestPdf] = useState(false);
  const [enteringContestId, setEnteringContestId] = useState<string | null>(null);

  // Active Contest Arena
  const [activeContest, setActiveContest] = useState<Contest | null>(null);
  const [activeContestProblems, setActiveContestProblems] = useState<Problem[]>([]);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);

  // Virtual Session State
  const [activeVirtualSession, setActiveVirtualSession] = useState<VirtualSession | null>(null);
  const [virtualModalContest, setVirtualModalContest] = useState<Contest | null>(null);
  const [startingVirtual, setStartingVirtual] = useState(false);
  
  // Virtual Leaderboard Modal State
  const [virtualLeaderboardContest, setVirtualLeaderboardContest] = useState<Contest | null>(null);
  const [virtualLeaderboard, setVirtualLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingVirtualLeaderboard, setLoadingVirtualLeaderboard] = useState(false);

  // History of student's virtual sessions per contest: contestId -> VirtualSession[]
  const [studentVirtualHistory, setStudentVirtualHistory] = useState<Record<string, VirtualSession[]>>({});

  // Submissions for this contest
  const [contestSubmissions, setContestSubmissions] = useState<Submission[]>([]);

  // Countdown timer in seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Anti-cheat tracking
  const [tabViolations, setTabViolations] = useState(0);
  const [showViolationModal, setShowViolationModal] = useState(false);

  useEffect(() => {
    fetchContests();

    if (socket) {
      socket.on('contest:updated', (updated: Contest) => {
        setContests(prev => prev.map(c => c.id === updated.id ? updated : c));
        if (activeContest && activeContest.id === updated.id) {
          setActiveContest(updated);
        }
      });

      socket.on('submission:finished', (sub: Submission) => {
        if (activeContest && sub.contestId === activeContest.id) {
          if (activeVirtualSession) {
            if (sub.virtualSessionId === activeVirtualSession.id) {
              setContestSubmissions(prev => [sub, ...prev.filter(s => s.id !== sub.id)]);
            }
          } else {
            if (!sub.isVirtual) {
              setContestSubmissions(prev => [sub, ...prev.filter(s => s.id !== sub.id)]);
            }
          }
        }
      });

      socket.on('contest:extra_time', (data: { contestId: string; extraMinutes: number; totalExtraMinutes: number }) => {
        alert(`⏰ Giám thị đã cộng thêm ${data.extraMinutes} phút làm bài thi cho bạn!`);
        setRemainingSeconds(prev => (prev !== null ? prev + data.extraMinutes * 60 : null));
      });

      socket.on('contest:suspended', (data: { contestId: string; reason: string }) => {
        alert(`⛔ BÀI THI CỦA BẠN ĐÃ BỊ ĐÌNH CHỈ!\nLý do: ${data.reason || 'Vi phạm quy chế phòng thi'}`);
        setActiveContest(null);
      });

      return () => {
        socket.off('contest:updated');
        socket.off('submission:finished');
        socket.off('contest:extra_time');
        socket.off('contest:suspended');
      };
    }
  }, [serverUrl, socket, user?.classId, activeContest]);

  // Anti-cheat detection: listen to tab switch & window blur
  useEffect(() => {
    if (!activeContest || activeContest.mode !== 'online' || !activeContest.antiCheat?.preventTabSwitch) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations(prev => {
          const next = prev + 1;
          setShowViolationModal(true);
          return next;
        });
      }
    };

    const handleBlur = () => {
      setTabViolations(prev => {
        const next = prev + 1;
        setShowViolationModal(true);
        return next;
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeContest]);

  // Countdown timer calculation
  useEffect(() => {
    if (!activeContest) {
      setRemainingSeconds(null);
      return;
    }

    const targetEndTime = activeVirtualSession 
      ? new Date(activeVirtualSession.endTime).getTime()
      : new Date(activeContest.endTime).getTime();

    const updateTimer = () => {
      const now = getServerNow ? getServerNow() : Date.now();
      const diffSec = Math.max(0, Math.floor((targetEndTime - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec === 0 && activeVirtualSession) {
        // Auto-finish virtual session when timer reaches zero
        apiFetch(`${serverUrl}/api/virtual-sessions/${activeVirtualSession.id}/finish`, { method: 'POST' }).catch(() => {});
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeContest, activeVirtualSession]);

  const fetchContests = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const classParam = user?.classId ? `&classId=${user.classId}` : '';
      const res = await apiFetch(`${serverUrl}/api/contests?role=user${classParam}`);
      if (res.ok) {
        const list: Contest[] = await res.json();
        setContests(list);
        setFetchError(null);

        // Fetch virtual sessions history for ended contests
        if (user) {
          list.filter(c => c.status === 'ended').forEach(async (c) => {
            try {
              const vRes = await apiFetch(`${serverUrl}/api/contests/${c.id}/virtual-sessions?userId=${user.id}`);
              if (vRes.ok) {
                const vsList = await vRes.json();
                setStudentVirtualHistory(prev => ({ ...prev, [c.id]: vsList }));
              }
            } catch (e) {}
          });
        }
      } else {
        setFetchError(`Không thể tải dữ liệu phòng thi từ máy chủ (Mã lỗi: ${res.status})`);
      }
    } catch (e: any) {
      console.error(e);
      setFetchError('Không thể kết nối đến máy chủ: ' + (e?.message || 'Lỗi mạng LAN'));
    } finally {
      setLoading(false);
    }
  };

  const handleEnterContest = async (c: Contest) => {
    if (enteringContestId) return;

    if (c.candidateIds && c.candidateIds.length > 0 && user && !c.candidateIds.includes(user.id)) {
      alert('Bạn không có tên trong danh sách thí sinh được phân công ca thi này. Vui lòng liên hệ giám thị phòng máy.');
      return;
    }

    setEnteringContestId(c.id);
    try {
      const cleanBase = (serverUrl || '').replace(/\/+$/, '');
      const res = await apiFetch(`${cleanBase}/api/contests/${c.id}?role=user`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Không thể tải dữ liệu phòng thi (Mã lỗi HTTP: ${res.status})`);
        return;
      }

      const fullContest: Contest = await res.json();
      if (fullContest.candidateIds && fullContest.candidateIds.length > 0 && user && !fullContest.candidateIds.includes(user.id)) {
        alert('Bạn không có tên trong danh sách thí sinh được phân công ca thi này. Vui lòng liên hệ giám thị phòng máy.');
        return;
      }

      if (fullContest.status === 'upcoming') {
        alert('Chưa đến giờ bắt đầu kỳ thi này! Vui lòng chờ giám thị phòng máy mở đề.');
        return;
      }

      setActiveContest(fullContest);
      setActiveContestProblems(fullContest.problems || []);
      setActiveProblem(null);
      setActiveVirtualSession(null);
      setTabViolations(0);

      // Register live attendance if user is logged in
      if (user) {
        apiFetch(`${cleanBase}/api/contests/${c.id}/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, status: 'present' })
        }).catch(() => {});

        // Fetch user's official submissions for this contest
        try {
          const subRes = await apiFetch(`${cleanBase}/api/submissions?userId=${user.id}&contestId=${c.id}&isVirtual=false`);
          if (subRes.ok) {
            setContestSubmissions(await subRes.json());
          }
        } catch (e) {
          console.warn('Could not fetch submissions:', e);
        }
      }
    } catch (e: any) {
      alert('Không thể kết nối đến máy chủ phòng thi: ' + (e.message || 'Lỗi mạng LAN'));
    } finally {
      setEnteringContestId(null);
    }
  };

  // Start Virtual Participation
  const handleStartVirtualContest = async (c: Contest) => {
    if (!user) return;
    setStartingVirtual(true);
    try {
      const res = await apiFetch(`${serverUrl}/api/contests/${c.id}/virtual-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userName: user.fullName || user.username })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể tạo phiên thi ảo');
        setStartingVirtual(false);
        return;
      }

      const session: VirtualSession = await res.json();

      // Fetch full contest details and problems
      const contestRes = await apiFetch(`${serverUrl}/api/contests/${c.id}`);
      const fullContest: Contest = await contestRes.json();

      setActiveContest(fullContest);
      setActiveContestProblems(fullContest.problems || []);
      setActiveProblem(null);
      setActiveVirtualSession(session);
      setVirtualModalContest(null);
      setTabViolations(0);
      setContestSubmissions([]);
    } catch (e: any) {
      alert('Lỗi khởi động thi ảo: ' + e.message);
    } finally {
      setStartingVirtual(false);
    }
  };

  // Finish Virtual Session early
  const handleFinishVirtualSession = async () => {
    if (!activeVirtualSession) return;
    if (!window.confirm('Bạn có chắc chắn muốn nộp bài và kết thúc phiên thi ảo này?')) return;

    try {
      await apiFetch(`${serverUrl}/api/virtual-sessions/${activeVirtualSession.id}/finish`, {
        method: 'POST'
      });
      alert('Phiên thi ảo đã kết thúc! Kết quả của bạn đã được ghi nhận vào Bảng Xếp Hạng Thi Ảo.');
      setActiveVirtualSession(null);
      setActiveContest(null);
      setActiveProblem(null);
      fetchContests();
    } catch (e: any) {
      console.error(e);
    }
  };

  // View Virtual Leaderboard for an ended contest
  const handleOpenVirtualLeaderboard = async (c: Contest) => {
    setVirtualLeaderboardContest(c);
    setLoadingVirtualLeaderboard(true);
    try {
      const res = await apiFetch(`${serverUrl}/api/contests/${c.id}/virtual-leaderboard`);
      if (res.ok) {
        setVirtualLeaderboard(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVirtualLeaderboard(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${pad(mins)}:${pad(secs)}`;
  };

  // If student is currently coding a specific problem inside the contest arena:
  if (activeContest && activeProblem) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Contest Header Banner */}
        <div style={{ 
          background: activeVirtualSession ? 'linear-gradient(90deg, #1e1b4b 0%, #0f172a 100%)' : 'var(--bg-surface-elevated)', 
          borderBottom: activeVirtualSession ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid var(--border-subtle)', 
          padding: '8px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          fontSize: '0.84rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => setActiveProblem(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft size={14} /> Danh Sách Bài Thi
            </button>
            <span style={{ fontWeight: 700, color: activeVirtualSession ? '#a5b4fc' : 'var(--accent-cyan)' }}>
              [{activeContest.title}]
            </span>
            {activeVirtualSession && (
              <span style={{ 
                fontSize: '0.72rem', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                background: 'rgba(99, 102, 241, 0.25)', 
                color: '#c7d2fe', 
                fontWeight: 700,
                border: '1px solid rgba(129, 140, 248, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={11} /> THI ẢO
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {remainingSeconds !== null && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontFamily: 'var(--font-mono)', 
                fontWeight: 800, 
                fontSize: '1rem',
                color: remainingSeconds < 300 ? 'var(--accent-rose)' : 'var(--accent-amber)'
              }}>
                <Timer size={16} />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>
            )}

            {activeVirtualSession && (
              <button 
                className="btn btn-danger btn-sm"
                style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                onClick={handleFinishVirtualSession}
              >
                Kết Thúc Phiên Ảo
              </button>
            )}

            {activeContest.mode === 'online' && activeContest.antiCheat?.preventTabSwitch && (
              <span style={{ 
                fontSize: '0.74rem', 
                padding: '2px 8px', 
                borderRadius: '4px',
                background: tabViolations > 0 ? 'rgba(244,63,94,0.15)' : 'rgba(56,189,248,0.15)',
                color: tabViolations > 0 ? '#f87171' : 'var(--accent-cyan)',
                fontWeight: 600
              }}>
                Cảnh báo rời tab: {tabViolations}/{activeContest.antiCheat.maxTabViolations}
              </span>
            )}
          </div>
        </div>

        {/* Problem Detail view */}
        <ProblemDetail 
          problem={activeProblem} 
          onBack={() => setActiveProblem(null)} 
          contestId={activeContest.id}
          isVirtual={!!activeVirtualSession}
          virtualSessionId={activeVirtualSession?.id}
          contestProblems={activeContest.problems || []}
          onSelectProblem={(p) => setActiveProblem(p)}
          contestTitle={activeContest.title}
          remainingSeconds={remainingSeconds}
          contestDocUrl={activeContest.pdfUrl}
          contestDocFileName={activeContest.pdfFileName}
        />

        {/* Violation Modal */}
        {showViolationModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="glass-panel" style={{ maxWidth: '440px', padding: '24px', textAlign: 'center', border: '2px solid var(--accent-rose)' }}>
              <ShieldAlert size={48} style={{ color: 'var(--accent-rose)', margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--accent-rose)', marginBottom: '8px' }}>CẢNH BÁO GIAN LẬN THI TRỰC TUYẾN</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                Hệ thống phát hiện bạn vừa <strong>rời khỏi cửa sổ làm bài hoặc chuyển sang tab khác</strong>!
              </p>
              <div style={{ background: 'rgba(244,63,94,0.1)', padding: '8px', borderRadius: '4px', marginBottom: '18px', fontWeight: 700, color: '#f87171' }}>
                Số lần vi phạm: {tabViolations} / {activeContest.antiCheat?.maxTabViolations || 3}
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => setShowViolationModal(false)}
              >
                Tôi Đã Hiểu Và Quay Lại Làm Bài
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If student is inside the Contest Room (viewing list of exam problems):
  if (activeContest) {
    const isOffline = activeContest.mode === 'offline';
    return (
      <div style={{ flex: 1, padding: '24px 36px', overflowY: 'auto' }}>
        {/* Arena Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (activeVirtualSession) {
                  if (window.confirm('Rời khỏi sẽ giữ nguyên thời gian đếm ngược của phiên thi ảo. Bạn có muốn thoát ra danh sách?')) {
                    setActiveContest(null);
                  }
                } else {
                  setActiveContest(null);
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <ArrowLeft size={15} /> Rời Phòng Thi
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.35rem', margin: 0 }}>{activeContest.title}</h2>
                {activeVirtualSession ? (
                  <span style={{ fontSize: '0.74rem', padding: '2px 10px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', fontWeight: 700, border: '1px solid rgba(129, 140, 248, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} /> THI ẢO (VIRTUAL)
                  </span>
                ) : isOffline ? (
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Wifi size={12} /> OFFLINE (LAN)
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} /> ONLINE (INTERNET)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {activeContest.description || 'Hãy giải quyết các bài tập dưới đây theo thời gian quy định'}
              </div>
            </div>
          </div>

          {/* Large Countdown Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {activeVirtualSession ? 'THỜI GIAN THI ẢO CÒN LẠI' : 'THỜI GIAN CÒN LẠI'}
                </div>
                <div style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '1.45rem', 
                  fontWeight: 900,
                  color: remainingSeconds !== null && remainingSeconds < 300 ? 'var(--accent-rose)' : 'var(--accent-amber)'
                }}>
                  {remainingSeconds !== null ? formatTimer(remainingSeconds) : '--:--'}
                </div>
              </div>
              <Timer size={24} style={{ color: 'var(--accent-amber)' }} />
            </div>

            {activeVirtualSession && (
              <button 
                className="btn btn-danger btn-sm"
                onClick={handleFinishVirtualSession}
                style={{ padding: '8px 14px' }}
              >
                Nộp & Kết Thúc Phiên Ảo
              </button>
            )}
          </div>
        </div>

        {/* Instructions banner */}
        <div className="glass-card" style={{ 
          padding: '14px 18px', 
          marginBottom: '24px', 
          borderLeft: `4px solid ${activeVirtualSession ? '#818cf8' : isOffline ? '#10b981' : '#38bdf8'}` 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>
            {activeVirtualSession ? (
              <Sparkles size={16} style={{ color: '#818cf8' }} />
            ) : isOffline ? (
              <Wifi size={16} style={{ color: '#10b981' }} />
            ) : (
              <ShieldAlert size={16} style={{ color: '#38bdf8' }} />
            )}
            <span>
              {activeVirtualSession 
                ? 'Chế độ Thi Ảo (Virtual Contest): Mô phỏng trải nghiệm thi thật' 
                : isOffline 
                ? 'Quy chế phòng thi: Chế độ Offline LAN (Nội bộ phòng máy)' 
                : 'Quy chế phòng thi: Chế độ Online (Chống gian lận)'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {activeVirtualSession ? (
              <span>
                Bạn đang thi lại kỳ thi đã kết thúc theo đúng thời lượng chuẩn <strong>({activeContest.durationMinutes} phút)</strong>. Bạn có thể nộp bài và nhận kết quả chấm ngay lập tức. Kết quả sẽ được lưu vào <strong>Bảng Xếp Hạng Thi Ảo</strong> riêng biệt.
              </span>
            ) : isOffline ? (
              <span>Bài thi đang diễn ra trên mạng LAN phòng máy. Không phụ thuộc mạng Internet bên ngoài. Bạn có thể nộp bài liên tục trước khi hết giờ.</span>
            ) : (
              <span>Kỳ thi có bật giám sát chống gian lận. Vui lòng <strong>không chuyển tab hoặc mở ứng dụng khác</strong> trong lúc làm bài (tối đa {activeContest.antiCheat?.maxTabViolations || 3} lần cảnh báo).</span>
            )}
            {!activeVirtualSession && activeContest.gradingMode === 'batch_after_deadline' && (
              <span style={{ display: 'block', marginTop: '4px', color: 'var(--accent-cyan)' }}>
                ℹ️ Kỳ thi áp dụng hình thức Chấm sau khi hết giờ. Kết quả và điểm số chi tiết sẽ được công bố sau khi kết thúc giờ thi.
              </span>
            )}
          </div>
        </div>

        {/* Contest PDF Banner if teacher uploaded an overall PDF */}
        {activeContest.pdfUrl && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '14px 20px', 
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.08))', 
            border: '1.5px solid rgba(239, 68, 68, 0.35)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: '22px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <FileText size={32} color="var(--accent-rose)" />
              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  📄 Đề Thi Tổng Hợp Dạng PDF: {activeContest.pdfFileName || `${activeContest.title}.pdf`}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Giáo viên đã đính kèm toàn bộ đề bài và dữ liệu vào/ra dưới dạng file PDF. Bạn có thể mở xem trực tiếp hoặc tải về máy.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setViewingContestPdf(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Eye size={14} /> Xem Toàn Bộ Đề Thi (PDF)
              </button>
              <a 
                href={`${serverUrl}${activeContest.pdfUrl}`}
                download={activeContest.pdfFileName || `${activeContest.title}.pdf`}
                className="btn btn-outline btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <Download size={14} /> Tải Về
              </a>
            </div>
          </div>
        )}

        {/* Problem Cards in Exam */}
        <div style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
          ĐỀ THI GỒM CÁC BÀI TẬP ({activeContestProblems.length} bài)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {activeContestProblems.map((prob, idx) => {
            // Find student's best submission for this problem in contest
            const problemSubs = contestSubmissions.filter(s => s.problemId === prob.id);
            const bestSub = problemSubs.reduce((best, cur) => cur.score > (best?.score || 0) ? cur : best, null as Submission | null);

            return (
              <div 
                key={prob.id}
                className="glass-card table-row-hover"
                style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                onClick={() => setActiveProblem(prob)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      BÀI THI #{idx + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {prob.pdfUrl && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <FileText size={10} /> Đề PDF
                        </span>
                      )}
                      <span style={{ 
                        fontSize: '0.78rem', 
                        fontFamily: 'var(--font-mono)', 
                        fontWeight: 800, 
                        color: 'var(--accent-cyan)' 
                      }}>
                        {prob.code}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
                    {prob.title}
                  </h3>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Thời gian: {prob.timeLimit}ms • Bộ nhớ: {prob.memoryLimit}MB • Điểm: {prob.points}đ
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div>
                    {bestSub ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <VerdictBadge status={bestSub.status} size="sm" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: bestSub.score === 100 ? 'var(--accent-emerald)' : 'var(--text-main)' }}>
                          {bestSub.score} / {prob.points}đ
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Chưa nộp bài</span>
                    )}
                  </div>

                  <button className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Vào Làm Bài <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── MODAL: XEM ĐỀ THI TỔNG HỢP PDF BÊN TRONG PHÒNG THI ─────── */}
        {viewingContestPdf && activeContest && activeContest.pdfUrl && (
          <div className="modal-overlay" onClick={() => setViewingContestPdf(false)} style={{ zIndex: 9999 }}>
            <div 
              className="glass-panel" 
              style={{ width: '95%', maxWidth: '980px', height: '90vh', display: 'flex', flexDirection: 'column', padding: '20px' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={22} color="var(--accent-rose)" />
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Đề Thi: {activeContest.title}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeContest.pdfFileName || 'de_thi.pdf'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <a 
                    href={`${serverUrl}${activeContest.pdfUrl}`}
                    download={activeContest.pdfFileName || `${activeContest.title}.pdf`}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                  >
                    <Download size={13} /> Tải Về Máy
                  </a>
                  <button className="btn btn-outline btn-sm" onClick={() => setViewingContestPdf(false)}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <StatementViewer
                  url={activeContest.pdfUrl}
                  fileName={activeContest.pdfFileName}
                  title={activeContest.title}
                  serverUrl={serverUrl}
                  height="100%"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: Contest List View
  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={26} style={{ color: 'var(--accent-amber)' }} />
            <h2 style={{ fontSize: '1.45rem', margin: 0 }}>🏫 PHÒNG THI & LUYỆN TẬP</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Tham gia các kỳ thi đang diễn ra hoặc luyện tập lại các kỳ thi đã kết thúc dưới dạng <strong>Thi Ảo (Virtual Participation)</strong>
          </p>
        </div>

        <button 
          className="btn btn-outline" 
          onClick={fetchContests}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
          title="Làm mới danh sách kỳ thi từ máy chủ"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm Mới
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '12px' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Đang tải danh sách kỳ thi...</div>
        </div>
      ) : fetchError ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--accent-rose)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={42} style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Không thể tải dữ liệu phòng thi</div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 16px auto' }}>
            {fetchError}
          </p>
          <button className="btn btn-primary btn-sm" onClick={fetchContests} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Thử lại
          </button>
        </div>
      ) : contests.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Không có kỳ thi đang mở</div>
          <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            Hiện tại chưa có đợt thi nào được giáo viên kích hoạt cho lớp của bạn. Bạn hãy chờ giáo viên hoặc bấm <strong>"Làm Mới"</strong> khi được thông báo bắt đầu.
          </p>
          <button className="btn btn-outline btn-sm" onClick={fetchContests} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Làm Mới
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {contests.map(c => {
            const isOffline = c.mode === 'offline';
            const isRunning = c.status === 'running';
            const isUpcoming = c.status === 'upcoming';
            const isEnded = c.status === 'ended';
            const userPastVirtuals = studentVirtualHistory[c.id] || [];
            const bestVirtualScore = userPastVirtuals.reduce((max, s) => Math.max(max, s.score || 0), 0);

            return (
              <div 
                key={c.id}
                className="glass-card"
                style={{ 
                  padding: '22px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${isEnded ? '#6366f1' : isOffline ? '#10b981' : '#38bdf8'}` 
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    {isOffline ? (
                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        background: 'rgba(16, 185, 129, 0.15)', 
                        color: '#34d399',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Wifi size={12} /> OFFLINE (LAN)
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        background: 'rgba(56, 189, 248, 0.15)', 
                        color: '#38bdf8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Globe size={12} /> ONLINE (WEB)
                      </span>
                    )}

                    <div>
                      {isRunning && <span className="badge badge-ac">Đang diễn ra</span>}
                      {isUpcoming && <span className="badge badge-tle">Sắp diễn ra</span>}
                      {isEnded && (
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
                          Đã kết thúc
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>{c.title}</h3>
                  {c.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
                      {c.description}
                    </p>
                  )}

                  <div style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '16px', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Timer size={13} /> Thời lượng thi:
                      </span>
                      <strong style={{ color: 'var(--accent-amber)' }}>{c.durationMinutes} phút</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} /> {isEnded ? 'Đã thi ngày:' : 'Bắt đầu lúc:'}
                      </span>
                      <span>{new Date(c.startTime).toLocaleString('vi-VN')}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Layers size={13} /> Số bài thi:
                      </span>
                      <strong>{c.problemIds.length} bài tập</strong>
                    </div>

                    {isEnded && userPastVirtuals.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', marginTop: '2px', color: '#c7d2fe' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Award size={13} color="#a5b4fc" /> Luyện tập ảo:
                        </span>
                        <strong>{userPastVirtuals.length} lần (Cao nhất: {bestVirtualScore}đ)</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  {isRunning ? (
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', padding: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleEnterContest(c)}
                      disabled={enteringContestId === c.id}
                    >
                      <Play size={16} /> {enteringContestId === c.id ? 'Đang vào phòng thi...' : 'VÀO PHÒNG THI NGAY'}
                    </button>
                  ) : isUpcoming ? (
                    <div style={{ textAlign: 'center', color: 'var(--accent-amber)', fontSize: '0.82rem', fontWeight: 600 }}>
                      Chưa đến giờ mở đề thi. Vui lòng chờ giáo viên!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ 
                          flex: 1, 
                          padding: '8px', 
                          fontWeight: 700, 
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          border: 'none',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '6px' 
                        }}
                        onClick={() => setVirtualModalContest(c)}
                        title="Mô phỏng thi lại như lúc thi thật với đồng hồ đếm ngược"
                      >
                        <RotateCcw size={15} /> Tham Gia Ảo
                      </button>

                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleOpenVirtualLeaderboard(c)}
                        title="Xem bảng xếp hạng của các bạn đã thi ảo kỳ thi này"
                      >
                        <BarChart3 size={15} /> BXH Ảo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Virtual Participation Confirm Modal */}
      {virtualModalContest && (
        <div className="modal-overlay" onClick={() => setVirtualModalContest(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '520px', padding: '26px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Sparkles size={20} color="#818cf8" /> Tham Gia Ảo (Virtual Participation)
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setVirtualModalContest(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#c7d2fe', marginBottom: '4px' }}>
                {virtualModalContest.title}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Thời lượng làm bài: <strong>{virtualModalContest.durationMinutes} phút</strong> • Đề gồm: <strong>{virtualModalContest.problemIds.length} bài</strong>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '22px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                Quy chế thi ảo (tương tự Virtual Contest trên Codeforces):
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                <li>Đồng hồ đếm ngược sẽ chạy lại từ đầu <strong>({virtualModalContest.durationMinutes} phút)</strong> tính từ lúc bạn bấm Bắt đầu.</li>
                <li>Bạn sẽ giải bài và nộp code trong không gian giống hệt lúc thi thật.</li>
                <li>Kết quả chấm sẽ được lưu vào <strong>Bảng Xếp Hạng Thi Ảo</strong> riêng biệt, không làm ảnh hưởng điểm số của những bạn đã thi chính thức.</li>
                <li>Bạn có thể luyện tập thi ảo lại nhiều lần để nâng cao trình độ.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setVirtualModalContest(null)}
              >
                Hủy
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', border: 'none' }}
                disabled={startingVirtual}
                onClick={() => handleStartVirtualContest(virtualModalContest)}
              >
                <Play size={15} /> {startingVirtual ? 'Đang tạo phòng thi...' : 'Bắt Đầu Làm Bài Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Virtual Leaderboard Modal */}
      {virtualLeaderboardContest && (
        <div className="modal-overlay" onClick={() => setVirtualLeaderboardContest(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={22} color="#818cf8" /> Bảng Xếp Hạng Thi Ảo
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Kỳ thi: <strong>{virtualLeaderboardContest.title}</strong>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setVirtualLeaderboardContest(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingVirtualLeaderboard ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải bảng xếp hạng...</div>
              ) : virtualLeaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                  <RotateCcw size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
                  <div>Chưa có học sinh nào tham gia thi ảo kỳ thi này.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Hãy là người đầu tiên thử sức với tính năng Tham Gia Ảo!</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      <th style={{ padding: '10px 8px' }}>HẠNG</th>
                      <th style={{ padding: '10px 8px' }}>HỌC SINH</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>SỐ BÀI AC</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>TỔNG ĐIỂM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {virtualLeaderboard.map((entry, idx) => (
                      <tr 
                        key={entry.userId} 
                        style={{ 
                          borderBottom: '1px solid var(--border-subtle)',
                          background: entry.userId === user?.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 8px', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)' }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ fontWeight: 700, color: entry.userId === user?.id ? '#c7d2fe' : 'var(--text-main)' }}>
                            {entry.userName || entry.username}
                          </span>
                          {entry.userId === user?.id && (
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>
                              Bạn
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                          {entry.problemsSolved}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-amber)', fontSize: '0.95rem' }}>
                          {entry.totalScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setVirtualLeaderboardContest(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
