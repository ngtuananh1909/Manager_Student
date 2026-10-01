import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Submission } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { useAuth } from '../../context/AuthContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { DiffViewer } from '../../components/DiffViewer';
import { Clock, Code, X, Check, Copy, GitCompare, ChevronDown, ChevronUp, FileText, AlertCircle } from 'lucide-react';

export const SubmissionsHistory: React.FC = () => {
  const { serverUrl } = useNetwork();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [modalTab, setModalTab] = useState<'tests' | 'code'>('tests');
  const [expandedWAIndices, setExpandedWAIndices] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [serverUrl, user]);

  const fetchSubmissions = async () => {
    try {
      const url = user ? `${serverUrl}/api/submissions?userId=${user.id}` : `${serverUrl}/api/submissions`;
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

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Lịch Sử Nộp Bài Của Bạn</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Theo dõi tiến độ, phán quyết chấm bài, thời gian thực thi và diff so sánh chi tiết cho các test case sai
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải lịch sử...</div>
      ) : submissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          Bạn chưa có lượt nộp bài nào. Hãy vào mục "Bài Tập C++" để bắt đầu giải bài!
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
              {submissions.map((sub) => (
                <tr 
                  key={sub.id} 
                  style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-cyan)' }}>
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
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => handleOpenSubmission(sub)}
                    >
                      <FileText size={13} /> Chi tiết & Diff
                    </button>
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
    </div>
  );
};
