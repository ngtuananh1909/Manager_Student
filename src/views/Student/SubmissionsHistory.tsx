import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { Submission } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { DiffViewer } from '../../components/DiffViewer';
import { 
  Clock, 
  Code, 
  X, 
  Check, 
  Copy, 
  GitCompare, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  AlertCircle,
  Sparkles,
  Search,
  Filter,
  Lightbulb,
  Lock,
  Unlock,
  Zap,
  CheckCircle2,
  Trophy
} from 'lucide-react';

interface SolutionModalData {
  isOpen: boolean;
  loading: boolean;
  problemCode: string;
  problemTitle: string;
  solution?: string;
  error?: string;
}

export const SubmissionsHistory: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [modalTab, setModalTab] = useState<'tests' | 'code'>('tests');
  const [expandedWAIndices, setExpandedWAIndices] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [copiedSolution, setCopiedSolution] = useState(false);

  // Filters & Search
  const [searchCode, setSearchCode] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Solution Modal State
  const [solutionModal, setSolutionModal] = useState<SolutionModalData>({
    isOpen: false,
    loading: false,
    problemCode: '',
    problemTitle: '',
  });

  useEffect(() => {
    fetchSubmissions();
  }, [serverUrl]);

  const fetchSubmissions = async () => {
    try {
      const url = `${serverUrl}/api/submissions`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySolutionCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2000);
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

  // Open Solution / Editorial
  const handleOpenSolution = async (sub: Submission) => {
    setSolutionModal({
      isOpen: true,
      loading: true,
      problemCode: sub.problemCode,
      problemTitle: `Bài ${sub.problemCode}`
    });

    try {
      const targetId = sub.problemId || sub.problemCode;
      const res = await apiFetch(`${serverUrl}/api/problems/${targetId}/solution`);
      const data = await res.json();

      if (res.ok && data.allowed) {
        setSolutionModal({
          isOpen: true,
          loading: false,
          problemCode: data.problemCode || sub.problemCode,
          problemTitle: data.problemTitle || sub.problemCode,
          solution: data.solution || 'Bài này chưa được giáo viên cập nhật nội dung lời giải chi tiết.'
        });
      } else {
        setSolutionModal({
          isOpen: true,
          loading: false,
          problemCode: sub.problemCode,
          problemTitle: sub.problemCode,
          error: data.error || 'Bạn cần đạt AC (100 điểm) để mở khóa lời giải thuật toán cho bài này.'
        });
      }
    } catch (err: any) {
      setSolutionModal({
        isOpen: true,
        loading: false,
        problemCode: sub.problemCode,
        problemTitle: sub.problemCode,
        error: 'Không thể kết nối đến máy chủ để lấy lời giải.'
      });
    }
  };

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchSearch = !searchCode || s.problemCode.toLowerCase().includes(searchCode.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [submissions, searchCode, statusFilter]);

  // KPI Analytics
  const stats = useMemo(() => {
    const total = submissions.length;
    if (total === 0) return { total: 0, acCount: 0, acRate: 0, avgScore: 0, bestTime: 0 };
    const acCount = submissions.filter(s => s.status === 'AC').length;
    const acRate = Math.round((acCount / total) * 100);
    const avgScore = Math.round(submissions.reduce((acc, s) => acc + (s.score || 0), 0) / total);
    const validTimes = submissions.map(s => s.executionTime || 0).filter(t => t > 0);
    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : 0;
    return { total, acCount, acRate, avgScore, bestTime };
  }, [submissions]);

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} color="var(--accent-cyan)" /> Lịch Sử Nộp Bài & Lời Giải Thuật Toán
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Theo dõi phán quyết máy chấm, thời gian thực thi, so sánh diff lỗi và mở khóa lời giải mẫu (Editorial).
          </p>
        </div>
      </div>

      {/* KPI Cards Overview */}
      {submissions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-cyan)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Tổng lượt nộp
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Lần gửi mã nguồn lên máy chấm
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-emerald)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Accepted (AC)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
              {stats.acCount} <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>({stats.acRate}%)</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tỉ lệ vượt qua toàn bộ test
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-amber)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Điểm trung bình
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '4px' }}>
              {stats.avgScore} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Điểm số các lần nộp
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '4px solid #a855f7' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Thời gian nhanh nhất
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
              {stats.bestTime} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ms</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tối ưu hóa thuật toán tốt nhất
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            className="input-field"
            placeholder="Lọc theo mã bài (VD: SUM, ARRAY)..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
          />
        </div>

        {/* Verdict Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '4px' }}>Phán quyết:</span>
          {['ALL', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${statusFilter === st ? 'var(--primary)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {st === 'ALL' ? 'Tất cả' : st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải lịch sử...</div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          {submissions.length === 0 ? 'Bạn chưa có lượt nộp bài nào. Hãy vào mục "Luyện Tập" để bắt đầu giải bài!' : 'Không tìm thấy bài nộp nào phù hợp với bộ lọc.'}
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '14px 18px' }}>MÃ BÀI</th>
                <th style={{ padding: '14px 18px' }}>KẾT QUẢ</th>
                <th style={{ padding: '14px 18px' }}>ĐIỂM</th>
                <th style={{ padding: '14px 18px' }}>TEST PASS</th>
                <th style={{ padding: '14px 18px' }}>THỜI GIAN</th>
                <th style={{ padding: '14px 18px' }}>BỘ NHỚ</th>
                <th style={{ padding: '14px 18px' }}>THỜI ĐIỂM NỘP</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => (
                <tr 
                  key={sub.id} 
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {sub.problemCode}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <VerdictBadge status={sub.status} size="sm" />
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                    <span style={{ color: sub.score === 100 ? 'var(--accent-emerald)' : 'var(--text-main)' }}>
                      {sub.score}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>
                    {sub.passedTests} / {sub.totalTests}
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>
                    {sub.executionTime} ms
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)' }}>
                    {sub.memoryUsed} KB
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(sub.submittedAt).toLocaleTimeString()} {new Date(sub.submittedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      {/* Solution / Editorial Button */}
                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--accent-amber)' }}
                        onClick={() => handleOpenSolution(sub)}
                        title="Xem gợi ý & lời giải thuật toán"
                      >
                        <Lightbulb size={13} /> Lời Giải
                      </button>

                      <button 
                        className="btn btn-outline btn-sm" 
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => handleOpenSubmission(sub)}
                      >
                        <FileText size={13} /> Chi tiết & Diff
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code & Diff Viewer Modal */}
      {selectedSub && (
        <div className="modal-overlay" onClick={() => setSelectedSub(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Chi Tiết Bài Nộp: {selectedSub.problemCode}</h3>
                  <VerdictBadge status={selectedSub.status} size="sm" />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedSub.score} điểm • {selectedSub.executionTime}ms • Nộp lúc: {new Date(selectedSub.submittedAt).toLocaleTimeString()} {new Date(selectedSub.submittedAt).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyCode(selectedSub.code)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Đã sao chép' : 'Sao chép code'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedSub(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
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
                <div style={{ 
                  background: '#1e1e1e', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px', 
                  border: '1px solid var(--border-subtle)'
                }}>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {selectedSub.code}
                  </pre>
                </div>
              ) : (
                <div>
                  {selectedSub.status === 'CE' && selectedSub.compileError && (
                    <div style={{ marginBottom: '14px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={14} /> LỖI BIÊN DỊCH (COMPILE ERROR):
                      </div>
                      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                        {selectedSub.compileError}
                      </pre>
                    </div>
                  )}

                  {selectedSub.details && selectedSub.details.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedSub.details.map((detail, idx) => (
                        <div 
                          key={idx}
                          style={{
                            background: 'var(--bg-app)',
                            border: `1px solid ${detail.status === 'AC' ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.3)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Test #{detail.testIndex}</span>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {detail.time}ms • {detail.memory}KB
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <VerdictBadge status={detail.status} size="sm" />

                              {detail.status === 'WA' && (
                                <button
                                  onClick={() => setExpandedWAIndices(prev => {
                                    const next = new Set(prev);
                                    next.has(idx) ? next.delete(idx) : next.add(idx);
                                    return next;
                                  })}
                                  style={{
                                    background: expandedWAIndices.has(idx) ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.12)',
                                    border: '1px solid rgba(245,158,11,0.45)',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem',
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

                          {detail.status === 'WA' && expandedWAIndices.has(idx) && (
                            <DiffViewer
                              diff={detail.diff || []}
                              truncated={detail.diffTruncated}
                              userOutput={detail.userOutput}
                              expectedOutput={detail.expectedOutput}
                              showRawFallback={true}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      {selectedSub.status === 'QUEUED'
                        ? 'Bài nộp đang chờ chấm điểm.'
                        : 'Không có chi tiết từng test case cho bài nộp này.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Solution / Editorial Modal */}
      {solutionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setSolutionModal(prev => ({ ...prev, isOpen: false }))}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lightbulb size={20} color="var(--accent-amber)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>
                    Hướng Dẫn & Lời Giải: {solutionModal.problemCode}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {solutionModal.problemTitle}
                  </div>
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setSolutionModal(prev => ({ ...prev, isOpen: false }))}>
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {solutionModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Đang tải lời giải...
                </div>
              ) : solutionModal.error ? (
                <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
                  <Lock size={32} style={{ color: 'var(--accent-rose)', margin: '0 auto 10px auto' }} />
                  <h4 style={{ color: 'var(--accent-rose)', margin: '0 0 6px 0', fontSize: '1.05rem' }}>Lời Giải Chưa Được Mở Khóa</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                    {solutionModal.error}
                  </p>
                  <div style={{ marginTop: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    💡 Hãy thử tối ưu lại thuật toán và nộp bài để đạt 100 điểm AC trước khi xem lời giải nhé!
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 'var(--radius-sm)', padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                      <CheckCircle2 size={16} /> Đã mở khóa lời giải thuật toán chính thức
                    </div>
                    {solutionModal.solution && (
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 10px', fontSize: '0.76rem' }}
                        onClick={() => copySolutionCode(solutionModal.solution || '')}
                      >
                        {copiedSolution ? <Check size={12} /> : <Copy size={12} />} {copiedSolution ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    )}
                  </div>

                  <div style={{ 
                    background: 'var(--bg-surface-elevated)', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '18px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    color: 'var(--text-main)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {solutionModal.solution}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
