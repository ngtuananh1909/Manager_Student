import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { StudentCustomContest, CustomTestCase } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { DiffViewer } from '../../components/DiffViewer';
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  Play, 
  Save, 
  Edit3, 
  X, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Code, 
  FileText, 
  GitCompare, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Check
} from 'lucide-react';

const DEFAULT_SAMPLE_CPP = `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Viết code giải quyết bài toán của bạn ở đây
    int a, b;
    if (cin >> a >> b) {
        cout << a + b << "\\n";
    }
    
    return 0;
}
`;

export const CustomContestSandbox: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [contests, setContests] = useState<StudentCustomContest[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Contest Sandbox
  const [activeContest, setActiveContest] = useState<StudentCustomContest | null>(null);
  const [code, setCode] = useState<string>(DEFAULT_SAMPLE_CPP);
  const [grading, setGrading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedWAIndices, setExpandedWAIndices] = useState<Set<number>>(new Set());

  // Modal Create / Edit Contest
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContest, setEditingContest] = useState<Partial<StudentCustomContest>>({
    title: '',
    description: '',
    timeLimit: 1000,
    memoryLimit: 256,
    testCases: [
      { id: 'tc-1', name: 'Test 01', input: '3 5', expectedOutput: '8', score: 50 },
      { id: 'tc-2', name: 'Test 02 (Biên)', input: '1000000000 2000000000', expectedOutput: '3000000000', score: 50 }
    ]
  });

  useEffect(() => {
    fetchContests();
  }, [serverUrl]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${serverUrl}/api/student/custom-contests`);
      if (res.ok) {
        const data = await res.json();
        setContests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingContest({
      title: '',
      description: '',
      timeLimit: 1000,
      memoryLimit: 256,
      testCases: [
        { id: `tc-${Date.now()}-1`, name: 'Test 01', input: '1 2', expectedOutput: '3', score: 50 },
        { id: `tc-${Date.now()}-2`, name: 'Test 02', input: '10 20', expectedOutput: '30', score: 50 }
      ]
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contest: StudentCustomContest) => {
    setEditingContest(JSON.parse(JSON.stringify(contest)));
    setIsModalOpen(true);
  };

  const handleAddTestCase = () => {
    setEditingContest(prev => {
      const tcs = prev.testCases || [];
      const newTc: CustomTestCase = {
        id: `tc-${Date.now()}-${tcs.length + 1}`,
        name: `Test ${String(tcs.length + 1).padStart(2, '0')}`,
        input: '',
        expectedOutput: '',
        score: Math.round(100 / (tcs.length + 1))
      };
      return { ...prev, testCases: [...tcs, newTc] };
    });
  };

  const handleUpdateTestCase = (idx: number, field: keyof CustomTestCase, val: any) => {
    setEditingContest(prev => {
      const next = [...(prev.testCases || [])];
      next[idx] = { ...next[idx], [field]: val };
      return { ...prev, testCases: next };
    });
  };

  const handleDeleteTestCase = (idx: number) => {
    setEditingContest(prev => ({
      ...prev,
      testCases: (prev.testCases || []).filter((_, i) => i !== idx)
    }));
  };

  const handleSaveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContest.title?.trim()) {
      alert('Vui lòng nhập tên kỳ thi tự luyện');
      return;
    }

    try {
      const res = await apiFetch(`${serverUrl}/api/student/custom-contests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingContest)
      });
      if (res.ok) {
        const saved = await res.json();
        setIsModalOpen(false);
        fetchContests();
        if (activeContest?.id === saved.id) {
          setActiveContest(saved);
        }
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleDeleteContest = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa kỳ thi tự luyện này?')) return;
    try {
      const res = await apiFetch(`${serverUrl}/api/student/custom-contests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchContests();
        if (activeContest?.id === id) {
          setActiveContest(null);
        }
      }
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const handleSelectContest = (contest: StudentCustomContest) => {
    setActiveContest(contest);
    setCode(contest.lastCode || DEFAULT_SAMPLE_CPP);
    setExpandedWAIndices(new Set());
  };

  const handleRunAllTests = async () => {
    if (!activeContest) return;
    if (!code.trim()) {
      alert('Vui lòng nhập code C++ trước khi chạy');
      return;
    }

    setGrading(true);
    try {
      const res = await apiFetch(`${serverUrl}/api/student/custom-contests/${activeContest.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await res.json();
      if (res.ok) {
        setActiveContest(prev => prev ? ({ ...prev, lastCode: code, lastRunResult: result }) : null);
        if (result.details) {
          const firstWA = result.details.findIndex((d: any) => d.status === 'WA');
          setExpandedWAIndices(new Set(firstWA !== -1 ? [firstWA] : []));
        }
        fetchContests();
      } else {
        alert('Lỗi chấm bài: ' + (result.error || ''));
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chấm: ' + err.message);
    } finally {
      setGrading(false);
    }
  };

  const handleSaveCode = async () => {
    if (!activeContest) return;
    try {
      await apiFetch(`${serverUrl}/api/student/custom-contests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...activeContest, lastCode: code })
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {}
  };

  // ─── IF INSIDE A SANDBOX ──────────────────────────────────────────────────
  if (activeContest) {
    const runResult = activeContest.lastRunResult;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Top Sandbox Action Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '12px 24px', 
          background: 'var(--bg-surface-elevated)', 
          borderBottom: '1px solid var(--border-medium)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => setActiveContest(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Quay Lại
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {activeContest.title}
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                  {activeContest.testCases.length} Testcases
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Giới hạn: {activeContest.timeLimit}ms • {activeContest.memoryLimit}MB
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleSaveCode}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {saveSuccess ? <Check size={14} color="var(--accent-emerald)" /> : <Save size={14} />}
              {saveSuccess ? 'Đã Lưu Code' : 'Lưu Code'}
            </button>

            <button 
              className="btn btn-primary"
              onClick={handleRunAllTests}
              disabled={grading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 18px', fontWeight: 700 }}
            >
              <Play size={15} fill={grading ? 'none' : 'currentColor'} /> 
              {grading ? 'Đang Chấm Test...' : 'Chạy Toàn Bộ Test'}
            </button>
          </div>
        </div>

        {/* Workspace Split Panes */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          {/* Left Pane: Code Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-medium)', background: '#1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#252526', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9cdcfe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={14} /> solution.cpp
              </div>
              <div style={{ fontSize: '0.74rem', color: '#858585' }}>
                C++14 / C++17 (g++)
              </div>
            </div>

            <textarea 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              style={{ 
                flex: 1, 
                width: '100%', 
                background: '#1e1e1e', 
                color: '#d4d4d4', 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.88rem', 
                lineHeight: 1.6, 
                border: 'none', 
                outline: 'none', 
                padding: '16px', 
                resize: 'none' 
              }}
            />
          </div>

          {/* Right Pane: Testcases & Grading Results */}
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '18px 24px', background: 'var(--bg-app)' }}>
            {/* Verdict Summary Card */}
            {runResult ? (
              <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', borderLeft: `4px solid ${runResult.status === 'AC' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <VerdictBadge status={runResult.status} size="md" />
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: runResult.score === 100 ? 'var(--accent-emerald)' : 'var(--text-main)' }}>
                        {runResult.score} / 100 Điểm
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Pass: <strong>{runResult.passedTests} / {runResult.totalTests}</strong> tests • Thời gian: <strong>{runResult.executionTime}ms</strong> • RAM: <strong>{runResult.memoryUsed}KB</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {runResult.status === 'CE' && runResult.compileError && (
                  <div style={{ marginTop: '12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '4px' }}>
                      LỖI BIÊN DỊCH (COMPILE ERROR):
                    </div>
                    <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                      {runResult.compileError}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                💡 Nhấp <strong>"Chạy Toàn Bộ Test"</strong> ở trên để nạp code vào máy chấm và kiểm tra từng test case!
              </div>
            )}

            {/* Test Cases Results List */}
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--accent-cyan)" /> Chi Tiết Test Cases ({activeContest.testCases.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeContest.testCases.map((tc, idx) => {
                const detail = runResult?.details ? runResult.details[idx] : null;
                const isWA = detail?.status === 'WA';
                const isExpanded = expandedWAIndices.has(idx);

                return (
                  <div 
                    key={tc.id || idx}
                    className="glass-panel"
                    style={{ 
                      padding: '12px 14px', 
                      borderRadius: 'var(--radius-sm)',
                      border: detail ? `1px solid ${detail.status === 'AC' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` : '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem' }}>
                          #{idx + 1} {tc.name}
                        </span>
                        {detail && (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {detail.time}ms • {detail.memory}KB
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {detail ? (
                          <VerdictBadge status={detail.status} size="sm" />
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Chưa chạy</span>
                        )}

                        {isWA && (
                          <button
                            onClick={() => setExpandedWAIndices(prev => {
                              const next = new Set(prev);
                              next.has(idx) ? next.delete(idx) : next.add(idx);
                              return next;
                            })}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', color: 'var(--accent-amber)', borderColor: 'rgba(245,158,11,0.4)' }}
                          >
                            <GitCompare size={11} /> {isExpanded ? 'Ẩn Diff' : 'Xem Diff WA'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Diff viewer when WA */}
                    {isWA && isExpanded && detail && (
                      <div style={{ marginTop: '10px' }}>
                        <DiffViewer
                          diff={detail.diff || []}
                          truncated={false}
                          userOutput={detail.userOutput}
                          expectedOutput={detail.expectedOutput || tc.expectedOutput}
                          showRawFallback={true}
                        />
                      </div>
                    )}

                    {/* Show Inputs and Expected Output */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '4px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>INPUT:</div>
                        <pre style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                          {tc.input || '(trống)'}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>EXPECTED OUTPUT:</div>
                        <pre style={{ margin: '2px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                          {tc.expectedOutput || '(trống)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CONTESTS LIST VIEW ───────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FlaskConical size={24} color="var(--accent-cyan)" /> Đấu Trường Tự Luyện & Test Ground
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Nơi bạn có thể tự thiết kế bài thi, tự biên soạn bộ testcase (Input/Expected Output) và chấm thử mã nguồn C++ của chính mình.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> Tạo Kỳ Thi Tự Luyện Mới
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          Đang tải danh sách bài thi tự luyện...
        </div>
      ) : contests.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <FlaskConical size={42} style={{ color: 'var(--accent-cyan)', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: '0 0 6px 0' }}>Chưa Có Kỳ Thi Tự Luyện Nào</h3>
          <p style={{ fontSize: '0.86rem', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Hãy bấm nút <strong>"+ Tạo Kỳ Thi Tự Luyện Mới"</strong> để tự nhập các testcase và kiểm thử code C++ nhé!
          </p>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={15} /> Tạo Bài Thi Ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {contests.map((c) => {
            const hasResult = !!c.lastRunResult;
            return (
              <div 
                key={c.id}
                className="glass-panel"
                style={{ 
                  padding: '20px', 
                  borderRadius: 'var(--radius-md)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  gap: '16px',
                  border: hasResult && c.lastRunResult?.status === 'AC' 
                    ? '1px solid rgba(34, 197, 94, 0.4)' 
                    : '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      {c.title}
                    </h3>
                    {hasResult && <VerdictBadge status={c.lastRunResult!.status} size="sm" />}
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    {c.description || 'Không có mô tả'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)' }}>
                      {c.testCases.length} Test Cases
                    </span>
                    <span className="badge" style={{ background: 'var(--bg-surface-elevated)' }}>
                      {c.timeLimit || 1000}ms
                    </span>
                    {hasResult && (
                      <span className="badge" style={{ background: c.lastRunResult?.score === 100 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: c.lastRunResult?.score === 100 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        Điểm: {c.lastRunResult?.score}đ
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => handleOpenEdit(c)}
                      title="Chỉnh sửa test cases"
                    >
                      <Edit3 size={13} /> Sửa Test
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => handleDeleteContest(c.id)}
                      title="Xóa kỳ thi này"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleSelectContest(c)}
                  >
                    <Play size={13} fill="currentColor" /> Vào Luyện Tập
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create / Edit Custom Contest & Testcases */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '800px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>
                {editingContest.id ? 'Chỉnh Sửa Kỳ Thi Tự Luyện' : 'Tạo Kỳ Thi Tự Luyện Mới'}
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveContest} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    TÊN BÀI THI / ĐẤU TRƯỜNG *
                  </label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="VD: Kiểm thử thuật toán tìm kiếm / Test cực hạn bài A..."
                    value={editingContest.title || ''}
                    onChange={(e) => setEditingContest({ ...editingContest, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      TIME LIMIT (MS)
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={editingContest.timeLimit || 1000}
                      onChange={(e) => setEditingContest({ ...editingContest, timeLimit: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      MEMORY LIMIT (MB)
                    </label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={editingContest.memoryLimit || 256}
                      onChange={(e) => setEditingContest({ ...editingContest, memoryLimit: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    GHI CHÚ / MÔ TẢ
                  </label>
                  <textarea 
                    className="input-field" 
                    rows={2}
                    placeholder="Mục đích luyện tập, các trường hợp test đặc biệt cần chú ý..."
                    value={editingContest.description || ''}
                    onChange={(e) => setEditingContest({ ...editingContest, description: e.target.value })}
                  />
                </div>

                {/* Testcases Builder */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      🧪 BỘ TEST CASES TỰ TẠO ({(editingContest.testCases || []).length})
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddTestCase}
                      style={{ fontSize: '0.76rem' }}
                    >
                      <Plus size={13} /> Thêm Test Case
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(editingContest.testCases || []).map((tc, idx) => (
                      <div 
                        key={tc.id || idx}
                        style={{ 
                          background: 'var(--bg-surface)', 
                          border: '1px solid var(--border-subtle)', 
                          borderRadius: 'var(--radius-sm)', 
                          padding: '12px 14px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                              #{idx + 1}
                            </span>
                            <input 
                              type="text" 
                              className="input-field" 
                              style={{ width: '180px', padding: '3px 8px', fontSize: '0.78rem', height: 'auto' }}
                              value={tc.name || ''}
                              onChange={(e) => handleUpdateTestCase(idx, 'name', e.target.value)}
                              placeholder="Tên test (VD: Biên âm)"
                            />
                          </div>

                          <button 
                            type="button" 
                            className="btn btn-outline btn-sm" 
                            style={{ padding: '3px 8px', color: 'var(--accent-rose)' }}
                            onClick={() => handleDeleteTestCase(idx)}
                          >
                            <Trash2 size={12} /> Xóa
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              INPUT
                            </label>
                            <textarea 
                              className="input-field" 
                              rows={3}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                              placeholder="Nhập input của test..."
                              value={tc.input || ''}
                              onChange={(e) => handleUpdateTestCase(idx, 'input', e.target.value)}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              EXPECTED OUTPUT
                            </label>
                            <textarea 
                              className="input-field" 
                              rows={3}
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                              placeholder="Kết quả đúng cần có..."
                              value={tc.expectedOutput || ''}
                              onChange={(e) => handleUpdateTestCase(idx, 'expectedOutput', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-medium)', paddingTop: '14px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px', fontWeight: 700 }}>
                  <Save size={15} /> Lưu Bài Thi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
