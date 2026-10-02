import React, { useState, useEffect } from 'react';
import { apiFetch, downloadAuthenticatedFile } from '../../lib/api';
import { createViolationDeduper, ViolationSignal } from '../../lib/violationDeduper';
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
  const [filterTab, setFilterTab] = useState<'all' | 'running' | 'ended'>('all');

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

    const deduper = createViolationDeduper();
    const recordSignal = (signal: ViolationSignal) => {
      if (!deduper.shouldRecord(signal)) return;
      setTabViolations(prev => prev + 1);
      setShowViolationModal(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) recordSignal('visibilitychange');
    };

    const handleBlur = () => {
      recordSignal('blur');
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
      const res = await apiFetch(`${serverUrl}/api/contests`);
      if (res.ok) {
        const rawList: Contest[] = await res.json();
        // Rule 35 & 37: Deduplicate by examId (a contest only appears once even if student satisfies multiple criteria)
        const seen = new Set<string>();
        const list = rawList.filter(c => {
          if (!c || !c.id || seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        setContests(list);
        setFetchError(null);

        // Fetch virtual sessions history for ended contests
        if (user) {
          list.filter(c => c.status === 'ended').forEach(async (c) => {
            try {
              const vRes = await apiFetch(`${serverUrl}/api/contests/${c.id}/virtual-sessions`);
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

    setEnteringContestId(c.id);
    try {
      const cleanBase = (serverUrl || '').replace(/\/+$/, '');
      const pinCode = c.requiresPin ? window.prompt('Nhập mã PIN kỳ thi') : '';
      if (c.requiresPin && pinCode === null) return;
      const res = await apiFetch(`${cleanBase}/api/contests/${c.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: pinCode || '' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || `Không thể tải dữ liệu phòng thi (Mã lỗi HTTP: ${res.status})`);
        return;
      }

      const fullContest: Contest = await res.json();
      setActiveContest(fullContest);
      setActiveContestProblems(fullContest.problems || []);
      setActiveProblem(null);
      setActiveVirtualSession(null);
      setTabViolations(0);

      // Fetch authenticated student's official submissions for this contest.
      if (user) {
        try {
          const subRes = await apiFetch(`${cleanBase}/api/submissions?contestId=${c.id}&isVirtual=false`);
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
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Không thể tạo phiên thi ảo');
        setStartingVirtual(false);
        return;
      }

      const payload: VirtualSession & { contest: Contest } = await res.json();
      const session: VirtualSession = payload;
      const fullContest: Contest = payload.contest;

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
              <h3 style={{ color: 'var(--accent-rose)', marginBottom: '8px' }}>TÍN HIỆU RỜI CỬA SỔ LÀM BÀI</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                Hệ thống ghi nhận cửa sổ làm bài vừa mất focus hoặc bị ẩn. Đây là tín hiệu giám sát để giám thị xem xét, không phải kết luận gian lận.
              </p>
              <div style={{ background: 'rgba(244,63,94,0.1)', padding: '8px', borderRadius: '4px', marginBottom: '18px', fontWeight: 700, color: '#f87171' }}>
                Số tín hiệu cần xem xét: {tabViolations} / {activeContest.antiCheat?.maxTabViolations || 3}
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

  // ── Arena View (Contest Active, viewing problem list) ──
  if (activeContest) {
    const isOffline = activeContest.mode === 'offline';
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ── REDESIGNED LINEAR ARENA CONTROL BAR (42px) ── */}
        <div className="arena-control-bar">
          <div className="arena-control-left">
            <button 
              type="button"
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
              <ArrowLeft size={14} /> Danh Sách
            </button>
            <div className="arena-title-group">
              <h2 className="arena-contest-title">{activeContest.title}</h2>
              {activeVirtualSession ? (
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', border: '1px solid rgba(129, 140, 248, 0.4)' }}>
                  <Sparkles size={11} /> THI ẢO
                </span>
              ) : isOffline ? (
                <span className="badge badge-ac"><Wifi size={11} /> OFFLINE LAN</span>
              ) : (
                <span className="badge" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}><Globe size={11} /> CHỐNG GIAN LẬN</span>
              )}
            </div>
          </div>

          <div className="arena-control-right">
            {/* Live Countdown Chip */}
            <div className="arena-countdown-chip" title="Thời gian làm bài còn lại">
              <Timer size={14} style={{ color: 'var(--accent-amber)' }} />
              <span className="countdown-digits" style={{ color: remainingSeconds !== null && remainingSeconds < 300 ? 'var(--accent-rose)' : 'var(--accent-amber)' }}>
                {remainingSeconds !== null ? formatTimer(remainingSeconds) : '--:--'}
              </span>
            </div>

            {/* Overall PDF Statement Button */}
            {activeContest.pdfUrl && (
              <button 
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setViewingContestPdf(true)}
                title="Xem toàn bộ đề thi tổng hợp dạng PDF"
              >
                <FileText size={13} style={{ color: 'var(--accent-rose)' }} /> Đề PDF
              </button>
            )}

            {/* Virtual Finish Button */}
            {activeVirtualSession && (
              <button 
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleFinishVirtualSession}
              >
                Nộp & Kết Thúc
              </button>
            )}
          </div>
        </div>

        {/* ── LINEAR MASTER-DETAIL PROBLEM TABLE ── */}
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            DANH SÁCH BÀI TẬP ({activeContestProblems.length} bài)
          </div>
          {activeContest.gradingMode === 'batch_after_deadline' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
              Chấm sau khi hết giờ thi
            </span>
          )}
        </div>

        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                <th style={{ width: '110px' }}>Mã Bài</th>
                <th>Tên Đề Bài</th>
                <th style={{ width: '160px' }}>Giới Hạn</th>
                <th style={{ width: '120px' }}>Điểm Tối Đa</th>
                <th style={{ width: '150px' }}>Kết Quả</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {activeContestProblems.map((prob, idx) => {
                const problemSubs = contestSubmissions.filter(s => s.problemId === prob.id);
                const bestSub = problemSubs.reduce((best, cur) => cur.score > (best?.score || 0) ? cur : best, null as Submission | null);

                return (
                  <tr 
                    key={prob.id} 
                    className="data-table-row interactive"
                    onClick={() => setActiveProblem(prob)}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <span className="code-pill">{prob.code}</span>
                    </td>
                    <td>
                      <div className="table-problem-title">
                        <span>{prob.title}</span>
                        {prob.pdfUrl && (
                          <span className="pdf-tag"><FileText size={10} /> PDF</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                      {prob.timeLimit}s • {prob.memoryLimit}MB
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {prob.points} điểm
                    </td>
                    <td>
                      {bestSub ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <VerdictBadge status={bestSub.status} size="sm" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {bestSub.score}đ
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Chưa nộp</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); setActiveProblem(prob); }}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      >
                        Làm Bài <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                  <button
                    type="button"
                    onClick={() => downloadAuthenticatedFile(`${serverUrl}${activeContest.pdfUrl}`, activeContest.pdfFileName || `${activeContest.title}.pdf`).catch(error => alert(error.message))}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Download size={13} /> Tải Về Máy
                  </button>
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
  const filteredContests = contests.filter(c => {
    if (filterTab === 'running') return c.status === 'running';
    if (filterTab === 'ended') return c.status === 'ended';
    return true;
  });

  return (
    <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
      {/* ── HEADER & SEGMENTED TABS ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={18} style={{ color: 'var(--accent-amber)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Phòng Thi & Luyện Tập</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
            Tham gia các đợt thi trực tuyến hoặc làm bài thi ảo (Virtual Participation)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Linear Segmented Tabs */}
          <div className="linear-tabs">
            <button 
              type="button" 
              className={`linear-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              Tất Cả ({contests.length})
            </button>
            <button 
              type="button" 
              className={`linear-tab-btn ${filterTab === 'running' ? 'active' : ''}`}
              onClick={() => setFilterTab('running')}
            >
              <span className="live-indicator-dot" /> Đang Thi ({contests.filter(c => c.status === 'running').length})
            </button>
            <button 
              type="button" 
              className={`linear-tab-btn ${filterTab === 'ended' ? 'active' : ''}`}
              onClick={() => setFilterTab('ended')}
            >
              <Sparkles size={11} /> Thi Ảo ({contests.filter(c => c.status === 'ended').length})
            </button>
          </div>

          <button 
            type="button"
            className="btn btn-outline btn-sm" 
            onClick={fetchContests}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Làm mới danh sách kỳ thi từ máy chủ"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm Mới
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Đang tải danh sách kỳ thi...</div>
        </div>
      ) : fetchError ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--accent-rose)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={36} style={{ marginBottom: '10px' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px' }}>Không thể tải dữ liệu phòng thi</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 14px auto' }}>
            {fetchError}
          </p>
          <button className="btn btn-primary btn-sm" onClick={fetchContests} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Thử lại
          </button>
        </div>
      ) : filteredContests.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Trophy size={40} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.4 }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Không có kỳ thi trong danh mục này</div>
          <p style={{ fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto 14px auto' }}>
            Hiện tại chưa có đợt thi nào phù hợp với bộ lọc đã chọn. Bấm <strong>"Làm Mới"</strong> khi được thông báo mở đề.
          </p>
          <button className="btn btn-outline btn-sm" onClick={fetchContests} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Làm Mới
          </button>
        </div>
      ) : (
        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Trạng Thái</th>
                <th>Tên Kỳ Thi</th>
                <th style={{ width: '130px' }}>Chế Độ</th>
                <th style={{ width: '180px' }}>Thời Lượng</th>
                <th style={{ width: '110px' }}>Số Bài</th>
                <th style={{ width: '170px' }}>Thành Tích Ảo</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredContests.map(c => {
                const isOffline = c.mode === 'offline';
                const isRunning = c.status === 'running';
                const isUpcoming = c.status === 'upcoming';
                const isEnded = c.status === 'ended';
                const userPastVirtuals = studentVirtualHistory[c.id] || [];
                const bestVirtualScore = userPastVirtuals.reduce((max, s) => Math.max(max, s.score || 0), 0);

                return (
                  <tr 
                    key={c.id} 
                    className="data-table-row interactive"
                    onClick={() => {
                      if (isRunning) handleEnterContest(c);
                      else if (isEnded) setVirtualModalContest(c);
                    }}
                  >
                    <td>
                      {isRunning && (
                        <span className="badge badge-ac" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span className="live-indicator-dot" /> Đang Thi
                        </span>
                      )}
                      {isUpcoming && <span className="badge badge-tle">Sắp Mở</span>}
                      {isEnded && (
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
                          Đã Kết Thúc
                        </span>
                      )}
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{c.title}</div>
                        {c.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
                            {c.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {isOffline ? (
                        <span style={{ fontSize: '0.76rem', color: 'var(--accent-emerald)', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                          <Wifi size={12} /> LAN Offline
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                          <Globe size={12} /> Online Web
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Timer size={12} style={{ color: 'var(--accent-amber)' }} /> {c.durationMinutes} phút
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(c.startTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {c.problemIds?.length || 0} bài
                      </span>
                    </td>
                    <td>
                      {isEnded && userPastVirtuals.length > 0 ? (
                        <span style={{ fontSize: '0.76rem', color: '#c7d2fe', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {userPastVirtuals.length} lượt • Cao nhất: {bestVirtualScore}đ
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {isRunning ? (
                          <button 
                            type="button"
                            className="btn btn-primary btn-sm" 
                            style={{ padding: '4px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={(e) => { e.stopPropagation(); handleEnterContest(c); }}
                            disabled={enteringContestId === c.id}
                          >
                            <Play size={13} /> {enteringContestId === c.id ? 'Đang vào...' : 'Vào Thi'}
                          </button>
                        ) : isUpcoming ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>Chờ mở đề</span>
                        ) : (
                          <>
                            <button 
                              type="button"
                              className="btn btn-primary btn-sm" 
                              style={{ 
                                padding: '4px 10px', 
                                fontSize: '0.76rem', 
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                border: 'none',
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px' 
                              }}
                              onClick={(e) => { e.stopPropagation(); setVirtualModalContest(c); }}
                              title="Mô phỏng thi lại như lúc thi thật với đồng hồ đếm ngược"
                            >
                              <RotateCcw size={12} /> Thi Ảo
                            </button>
                            <button 
                              type="button"
                              className="btn btn-outline btn-sm" 
                              style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={(e) => { e.stopPropagation(); handleOpenVirtualLeaderboard(c); }}
                              title="Xem bảng xếp hạng ảo"
                            >
                              <BarChart3 size={12} /> BXH
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
