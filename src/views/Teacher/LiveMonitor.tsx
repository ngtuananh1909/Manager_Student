import React, { useState, useEffect } from 'react';
import { Submission, BatchGradeProgress } from '../../types';
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
  GitCompare,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle
} from 'lucide-react';

export const LiveMonitor: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [queueStatus, setQueueStatus] = useState<{ queueLength: number; activeWorkers: number }>({ queueLength: 0, activeWorkers: 0 });
  
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

  useEffect(() => {
    fetchSubmissions();
    fetchSettings();

    if (socket) {
      socket.on('submission:created', (newSub: Submission) => {
        setSubmissions(prev => [newSub, ...prev]);
      });

      socket.on('submission:update', (data: { id: string; status: any }) => {
        setSubmissions(prev => prev.map(s => s.id === data.id ? { ...s, status: data.status } : s));
      });

      socket.on('submission:finished', (finishedSub: Submission) => {
        setSubmissions(prev => prev.map(s => s.id === finishedSub.id ? finishedSub : s));
        // If modal is viewing this submission, update it
        setSelectedSub(prev => prev && prev.id === finishedSub.id ? finishedSub : prev);
      });

      socket.on('queue:status', (status: any) => {
        setQueueStatus(status);
      });

      socket.on('settings:update', (newSettings: any) => {
        if (newSettings.submissionsClosed !== undefined) setSubmissionsClosed(newSettings.submissionsClosed);
        if (newSettings.submissionMode !== undefined) setSubmissionMode(newSettings.submissionMode);
      });

      // Batch grading progress events
      socket.on('batch:grade:progress', (progress: BatchGradeProgress) => {
        setBatchProgress(progress);
        if (progress.finished || progress.cancelled) {
          setBatchRunning(false);
          setShowBatchSummary(true);
          fetchSubmissions(); // Refresh the table after batch complete
        }
      });

      return () => {
        socket.off('submission:created');
        socket.off('submission:update');
        socket.off('submission:finished');
        socket.off('queue:status');
        socket.off('settings:update');
        socket.off('batch:grade:progress');
      };
    }
  }, [serverUrl, socket]);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/submissions`);
      if (res.ok) setSubmissions(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/diagnostics`);
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
      const res = await fetch(`${serverUrl}/api/submissions/toggle-close`, { method: 'POST' });
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
      const res = await fetch(`${serverUrl}/api/grade-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regrade })
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
      await fetch(`${serverUrl}/api/grade-all/cancel`, { method: 'DELETE' });
    } catch (e) {}
  };

  const progressPct = batchProgress && batchProgress.total > 0
    ? Math.min(100, Math.round((batchProgress.done / batchProgress.total) * 100))
    : 0;

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Title & Queue Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={24} style={{ color: 'var(--accent-emerald)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Giám Sát Chấm Bài Realtime</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Theo dõi trực tiếp bài nộp của học sinh, chấm hàng loạt với tiến trình realtime và xem diff lỗi
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>HÀNG ĐỢI:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {queueStatus.queueLength} bài
            </span>
          </div>
          <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>WORKER CHẤM BÀI:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {queueStatus.activeWorkers} / 2
            </span>
          </div>
        </div>
      </div>

      {/* ── BATCH GRADE SECTION ─────────────────────────────── */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '20px 24px', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: batchRunning || showBatchSummary ? '18px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListChecks size={22} style={{ color: 'var(--primary-light)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Chấm Hàng Loạt (Batch Grade)</span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontWeight: 600,
                  background: submissionMode === 'batch' ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)',
                  color: submissionMode === 'batch' ? 'var(--accent-cyan)' : 'var(--accent-emerald)'
                }}>
                  {submissionMode === 'batch' ? 'Chế độ Nộp bài (Thi/Kiểm tra)' : 'Chế độ Chấm trực tiếp'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Chấm tất cả bài nộp của học sinh sau khi đóng thời gian nộp, có thanh tiến trình và huỷ giữa chừng
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Toggle portal open/close */}
            <button
              onClick={handleToggleSubmissionPortal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: submissionsClosed ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                border: `1px solid ${submissionsClosed ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.4)'}`,
                color: submissionsClosed ? '#f87171' : '#34d399'
              }}
              title="Đóng hoặc mở cổng cho phép học sinh nộp bài"
            >
              {submissionsClosed ? <Lock size={14} /> : <Unlock size={14} />}
              {submissionsClosed ? 'Cổng nộp: ĐÃ ĐÓNG' : 'Cổng nộp: ĐANG MỞ'}
            </button>

            {/* Filter toggle */}
            {!batchRunning && (
              <select
                className="input-field"
                style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
                value={batchFilter}
                onChange={e => setBatchFilter(e.target.value as 'queued' | 'all')}
              >
                <option value="queued">Chỉ bài chưa chấm (Chờ chấm)</option>
                <option value="all">Chấm lại tất cả bài nộp</option>
              </select>
            )}

            {batchRunning ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancelBatch}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontWeight: 700 }}
              >
                <StopCircle size={16} /> Huỷ Chấm Giữa Chừng
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBatchGrade}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontWeight: 700 }}
              >
                <PlayCircle size={16} /> Chấm Tất Cả
              </button>
            )}
          </div>
        </div>

        {/* ── PROGRESS BAR — Active during batch grading ─────── */}
        {batchRunning && batchProgress && (
          <div style={{ marginTop: '14px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--primary-light)' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Đang chấm bài: {batchProgress.currentUser && <strong style={{ color: 'var(--accent-cyan)' }}>{batchProgress.currentUser}</strong>}
                  {batchProgress.currentProblem && <span style={{ color: 'var(--text-secondary)' }}> — Bài [{batchProgress.currentProblem}]</span>}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {batchProgress.done} / {batchProgress.total} bài
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  ({progressPct}%)
                </span>
              </div>
            </div>

            {/* Visual Track */}
            <div style={{ height: '12px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #6366f1 0%, #38bdf8 100%)',
                borderRadius: '10px',
                transition: 'width 300ms ease',
                boxShadow: '0 0 10px rgba(99,102,241,0.6)'
              }} />
            </div>

            {/* Live Progress Stats */}
            <div style={{ display: 'flex', gap: '24px', fontSize: '0.82rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Chấm thành công: <strong>{batchProgress.success}</strong>
              </span>
              {batchProgress.errors > 0 && (
                <span style={{ color: 'var(--accent-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} /> Gặp lỗi (CE/RE): <strong>{batchProgress.errors}</strong>
                </span>
              )}
              <span style={{ color: 'var(--text-muted)' }}>
                Còn lại trong đợt chấm: <strong>{Math.max(0, batchProgress.total - batchProgress.done)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ── SUMMARY CARD — Shown after batch completion or cancel ── */}
        {showBatchSummary && batchProgress && !batchRunning && (
          <div style={{
            marginTop: '14px',
            background: batchProgress.cancelled ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${batchProgress.cancelled ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.98rem' }}>
                {batchProgress.cancelled ? (
                  <>
                    <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
                    <span style={{ color: 'var(--accent-amber)' }}>Đã huỷ chấm giữa chừng (đã hoàn tất {batchProgress.done}/{batchProgress.total} bài)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)' }} />
                    <span style={{ color: 'var(--accent-emerald)' }}>Hoàn tất chấm tất cả {batchProgress.done}/{batchProgress.total} bài nộp</span>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowBatchSummary(false)}
                style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              >
                Đóng tóm tắt
              </button>
            </div>

            <div style={{ display: 'flex', gap: '30px', fontSize: '0.88rem', paddingBottom: '10px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Chấm thành công: </span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '1rem' }}>{batchProgress.success} bài</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Gặp lỗi (CE / RE): </span>
                <strong style={{ color: batchProgress.errors > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)', fontSize: '1rem' }}>
                  {batchProgress.errors} bài
                </strong>
              </div>
            </div>

            {/* Error List for Teacher to Inspect and Handle */}
            {batchProgress.errorList && batchProgress.errorList.length > 0 && (
              <div style={{ marginTop: '12px', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} /> Danh sách bài nộp gặp lỗi cần giáo viên xử lý riêng ({batchProgress.errorList.length} bài):
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {batchProgress.errorList.map((err, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '6px 10px', 
                        background: 'var(--bg-app)', 
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                        <strong style={{ color: 'var(--accent-cyan)' }}>{err.userName}</strong>
                        {err.problemCode && <span style={{ color: 'var(--text-muted)' }}>[{err.problemCode}]</span>}
                        <span style={{ color: '#fca5a5', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          — {err.error}
                        </span>
                      </div>
                      
                      {/* Button to view submission immediately */}
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.72rem', flexShrink: 0, marginLeft: '8px' }}
                        onClick={() => {
                          const sub = submissions.find(s => s.id === err.submissionId);
                          if (sub) handleOpenSubmission(sub);
                        }}
                      >
                        Xem & Xử lý
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submissions Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '14px 18px' }}>HỌC SINH</th>
              <th style={{ padding: '14px 18px' }}>MÃ BÀI</th>
              <th style={{ padding: '14px 18px' }}>KẾT QUẢ</th>
              <th style={{ padding: '14px 18px' }}>ĐIỂM</th>
              <th style={{ padding: '14px 18px' }}>TEST PASS</th>
              <th style={{ padding: '14px 18px' }}>THỜI GIAN</th>
              <th style={{ padding: '14px 18px' }}>THỜI ĐIỂM</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Chưa có bài nộp nào trong phiên này.
                </td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 600 }}>{sub.userName}</td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    {sub.problemCode}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <VerdictBadge status={sub.status} size="sm" />
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 700 }}>{sub.score}</td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>
                    {sub.passedTests} / {sub.totalTests}
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>
                    {sub.executionTime}ms
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(sub.submittedAt).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button 
                      className="btn btn-outline btn-sm"
                      onClick={() => handleOpenSubmission(sub)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <FileText size={13} /> Chi tiết & Diff
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── SUBMISSION DETAILS & DIFF MODAL ─────────────────── */}
      {selectedSub && (
        <div className="modal-overlay" onClick={() => setSelectedSub(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '880px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                    Bài Nộp: <span style={{ color: 'var(--accent-cyan)' }}>{selectedSub.userName}</span> ({selectedSub.problemCode})
                  </h3>
                  <VerdictBadge status={selectedSub.status} size="md" />
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Điểm: <strong>{selectedSub.score}</strong> • Test pass: <strong>{selectedSub.passedTests}/{selectedSub.totalTests}</strong> • Thực thi: <strong>{selectedSub.executionTime}ms</strong> • Nộp lúc: {new Date(selectedSub.submittedAt).toLocaleTimeString()} {new Date(selectedSub.submittedAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyCode(selectedSub.code)}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Đã sao chép' : 'Sao chép code'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedSub(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tab switchers */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setModalTab('tests')}
                style={{
                  background: modalTab === 'tests' ? 'var(--primary)' : 'none',
                  color: modalTab === 'tests' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 14px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <GitCompare size={14} /> Kết Quả Test Cases & Diff WA
              </button>
              <button
                onClick={() => setModalTab('code')}
                style={{
                  background: modalTab === 'code' ? 'var(--primary)' : 'none',
                  color: modalTab === 'code' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 14px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Code size={14} /> Mã Nguồn C++
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {modalTab === 'code' ? (
                /* Tab 1: Source code */
                <div style={{ background: '#1e1e1e', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {selectedSub.code}
                  </pre>
                </div>
              ) : (
                /* Tab 2: Test cases breakdown & WA Diff */
                <div>
                  {/* Compilation error box if CE */}
                  {selectedSub.status === 'CE' && selectedSub.compileError && (
                    <div style={{ marginBottom: '16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={15} /> THÔNG BÁO LỖI BIÊN DỊCH G++ (COMPILE ERROR):
                      </div>
                      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                        {selectedSub.compileError}
                      </pre>
                    </div>
                  )}

                  {/* Queued / not yet judged info */}
                  {selectedSub.status === 'QUEUED' && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <ListChecks size={36} style={{ color: 'var(--accent-amber)', marginBottom: '10px' }} />
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>Bài nộp đang ở hàng đợi (Chờ chấm)</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto' }}>
                        Bài tập này được nộp trong Chế độ nộp bài. Bấm nút <strong>"Chấm Tất Cả"</strong> ở bảng giám sát để chấm toàn bộ bài nộp cùng lúc.
                      </p>
                    </div>
                  )}

                  {/* Test Cases List with Diff */}
                  {selectedSub.details && selectedSub.details.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedSub.details.map((detail, idx) => (
                        <div 
                          key={idx}
                          style={{
                            background: 'var(--bg-app)',
                            border: `1px solid ${
                              detail.status === 'AC' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.3)'
                            }`,
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 16px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '22px', 
                                height: '22px', 
                                borderRadius: '50%', 
                                background: detail.status === 'AC' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                color: detail.status === 'AC' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}>
                                {detail.status === 'AC' ? '✓' : '✗'}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                Test {String(detail.testIndex).padStart(2, '0')} {detail.name ? `(${detail.name})` : ''} — <span style={{ color: detail.status === 'AC' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{detail.status === 'AC' ? 'Đúng' : 'Sai'}</span>
                              </span>
                              {detail.isSample && (
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(56,189,248,0.2)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                  Test ví dụ
                                </span>
                              )}
                              {detail.isTrap && (
                                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.2)', color: 'var(--accent-amber)', fontWeight: 600 }}>
                                  Test bẫy
                                </span>
                              )}
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {detail.time}ms • {detail.memory}KB • {detail.scoreEarned || 0}đ
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <VerdictBadge status={detail.status} size="sm" />
                              {detail.status === 'WA' && (
                                <button
                                  onClick={() => setExpandedWAIndices(prev => {
                                    const next = new Set(prev);
                                    next.has(idx) ? next.delete(idx) : next.add(idx);
                                    return next;
                                  })}
                                  style={{
                                    background: expandedWAIndices.has(idx) ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.45)',
                                    borderRadius: '4px',
                                    padding: '3px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    color: 'var(--accent-amber)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <GitCompare size={12} />
                                  {expandedWAIndices.has(idx) ? 'Ẩn Diff' : 'Xem Diff WA'}
                                  {expandedWAIndices.has(idx) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Message error if any */}
                          {detail.message && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {detail.message}
                            </div>
                          )}

                          {/* Input and DiffViewer for teachers */}
                          {detail.status === 'WA' && expandedWAIndices.has(idx) && (
                            <div style={{ marginTop: '8px' }}>
                              {detail.input && (
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>INPUT FILE:</div>
                                  <pre style={{ margin: 0, padding: '6px 10px', background: '#090d16', borderRadius: '4px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', maxHeight: '90px', overflowY: 'auto' }}>
                                    {detail.input}
                                  </pre>
                                </div>
                              )}
                              <DiffViewer
                                diff={detail.diff || []}
                                truncated={detail.diffTruncated}
                                userOutput={detail.userOutput}
                                expectedOutput={detail.expectedOutput}
                                showRawFallback={true}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
