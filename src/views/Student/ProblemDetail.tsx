import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import { Problem, Submission, Verdict, Contest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { StatementViewer } from '../../components/StatementViewer';
import { ResizableSplitPane } from '../../components/ResizableSplitPane';
import { 
  Play, 
  Send, 
  Clock, 
  Cpu, 
  Copy, 
  Check, 
  Terminal, 
  ChevronLeft, 
  AlertCircle, 
  Sparkles,
  RefreshCw,
  FileText,
  ExternalLink,
  Download,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Code2,
  FileCode2,
  Shield
} from 'lucide-react';

interface Props {
  problem: Problem;
  onBack: () => void;
  contestId?: string;
  virtualSessionId?: string;
  contestProblems?: Problem[];
  onSelectProblem?: (p: Problem) => void;
  contestTitle?: string;
  remainingSeconds?: number | null;
  contestDocUrl?: string;
  contestDocFileName?: string;
}

export const ProblemDetail: React.FC<Props> = ({ 
  problem, 
  onBack, 
  contestId, 
  virtualSessionId,
  contestProblems = [],
  onSelectProblem,
  contestTitle,
  remainingSeconds,
  contestDocUrl,
  contestDocFileName
}) => {
  const { user } = useAuth();
  const { serverUrl, socket, isConnected } = useNetwork();

  // Storage key for auto-saving drafts per problem
  const storageKey = `schooljudge_draft_${contestId || 'free'}_${problem.id}`;

  const defaultTemplate = `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết code giải bài tập tại đây\n    \n    return 0;\n}\n`;

  const [code, setCode] = useState<string>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved : (problem.sampleCode || defaultTemplate);
  });

  const codeRef = useRef<string>(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const saveDraftTimerRef = useRef<any>(null);
  const [codeSaveStatus, setCodeSaveStatus] = useState<string>('Đã lưu nháp');
  const [splitPercent, setSplitPercent] = useState<number | null>(null);

  // Editor instance and container ref for smooth zero-recreate resizing
  const editorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Immediate flush of draft code to localStorage (guarantees 0% draft loss on tab close, reload, or navigation)
  const flushCodeDraft = useCallback(() => {
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
      saveDraftTimerRef.current = null;
    }
    const val = codeRef.current;
    if (val !== undefined && val !== null) {
      try {
        const key = `schooljudge_draft_${contestId || 'free'}_${problem.id}`;
        localStorage.setItem(key, val);
        const now = new Date();
        const pad = (n: number) => n < 10 ? '0' + n : n;
        setCodeSaveStatus(`Đã lưu ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      } catch (e) {}
    }
  }, [contestId, problem.id]);

  // Flush draft immediately on beforeunload, pagehide, and component unmount / problem switch
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushCodeDraft();
    };
    const handlePageHide = () => {
      flushCodeDraft();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      flushCodeDraft();
    };
  }, [flushCodeDraft]);

  // ResizeObserver on editor container: calls monaco.layout() without recreating Monaco, losing code or cursor
  useEffect(() => {
    if (!editorContainerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    });
    ro.observe(editorContainerRef.current);
    return () => {
      ro.disconnect();
    };
  }, []);

  // When switching problem, load the appropriate draft
  useEffect(() => {
    const saved = localStorage.getItem(`schooljudge_draft_${contestId || 'free'}_${problem.id}`);
    const initialCode = saved !== null ? saved : (problem.sampleCode || defaultTemplate);
    setCode(initialCode);
    codeRef.current = initialCode;
    // Reset custom run output
    setCustomOutput('');
    setCustomError('');
    setCustomTime(null);
    // Populate customInput from first sample if available
    const firstSampleInput = (problem.samples && problem.samples.length > 0)
      ? problem.samples[0].input
      : '';
    setCustomInput(firstSampleInput);
  }, [problem.id, contestId]);

  // Auto-save code draft on change with 600ms debounce to eliminate typing lag
  const handleCodeChange = (newCode: string | undefined) => {
    const val = newCode || '';
    setCode(val);
    codeRef.current = val;
    setCodeSaveStatus('Đang lưu...');
    if (saveDraftTimerRef.current) {
      clearTimeout(saveDraftTimerRef.current);
    }
    saveDraftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, val);
        const now = new Date();
        const pad = (n: number) => n < 10 ? '0' + n : n;
        setCodeSaveStatus(`Đã lưu ${pad(now.getHours())}:${pad(now.getMinutes())}`);
      } catch (e) {
        setCodeSaveStatus('Lỗi lưu nháp');
      }
    }, 600);
  };

  const [activeConsoleTab, setActiveConsoleTab] = useState<'custom' | 'result'>('custom');
  const [customInput, setCustomInput] = useState<string>(() => {
    return (problem.samples && problem.samples.length > 0) ? problem.samples[0].input : '';
  });
  const [customOutput, setCustomOutput] = useState<string>('');
  const [customTime, setCustomTime] = useState<number | null>(null);
  const [isRunningCustom, setIsRunningCustom] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [judgeProgress, setJudgeProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [copiedSampleIdx, setCopiedSampleIdx] = useState<{ type: 'in' | 'out'; idx: number } | null>(null);

  // Document view mode
  const hasDocFile = !!(problem.pdfUrl || contestDocUrl);
  const docFileUrl = problem.pdfUrl || contestDocUrl;
  const docFileName = problem.pdfFileName || contestDocFileName;

  const [contestInfo, setContestInfo] = useState<Contest | null>(null);

  useEffect(() => {
    if (contestId && serverUrl) {
      apiFetch(`${serverUrl}/api/contests/${contestId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) setContestInfo(data);
        })
        .catch(() => {});
    }
  }, [contestId, serverUrl]);

  // Live submission progress via Socket.io
  useEffect(() => {
    if (!socket || !currentSubmission) return;

    const subId = currentSubmission.id;

    socket.on(`submission:${subId}:status`, (data: { status: Verdict; message: string }) => {
      setCurrentSubmission(prev => prev ? { ...prev, status: data.status } : null);
    });

    socket.on(`submission:${subId}:progress`, (data: { currentTest: number; totalTests: number; message: string }) => {
      setJudgeProgress({ current: data.currentTest, total: data.totalTests, message: data.message });
    });

    socket.on(`submission:${subId}:result`, (sub: Submission) => {
      setCurrentSubmission(sub);
      setIsSubmitting(false);
      setJudgeProgress(null);

      // Trigger celebratory confetti if AC!
      if (sub.status === 'AC') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    return () => {
      socket.off(`submission:${subId}:status`);
      socket.off(`submission:${subId}:progress`);
      socket.off(`submission:${subId}:result`);
    };
  }, [socket, currentSubmission?.id]);

  // Handle Custom Input Run (Runs user code with custom input, NO comparison with secret test cases)
  const handleRunCustom = async () => {
    flushCodeDraft();
    setIsRunningCustom(true);
    setActiveConsoleTab('custom');
    setCustomOutput('');
    setCustomError('');
    setCustomTime(null);

    try {
      const res = await apiFetch(`${serverUrl}/api/custom-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          input: customInput, 
          problemCode: problem.code,
          timeLimit: problem.timeLimit || 1000,
          memoryLimit: problem.memoryLimit || 256
        })
      });

      const data = await res.json();
      setIsRunningCustom(false);

      if (data.status === 'CE') {
        setCustomError(`COMPILATION ERROR (LỖI BIÊN DỊCH):\n${data.stderr || 'Lỗi cú pháp'}`);
      } else if (data.status === 'RE') {
        setCustomError(`RUNTIME ERROR (LỖI THỰC THI):\n${data.stderr || 'Chương trình dừng đột ngột (Segmentation fault / division by zero...)'}`);
        if (data.stdout) setCustomOutput(data.stdout);
      } else if (data.status === 'TLE') {
        setCustomError(`TIME LIMIT EXCEEDED (QUÁ THỜI GIAN):\nChương trình chạy vượt quá giới hạn thời gian (${problem.timeLimit || 1000}ms).`);
      } else if (data.status === 'MLE') {
        setCustomError(`MEMORY LIMIT EXCEEDED (VƯỢT GIỚI HẠN BỘ NHỚ):\nChương trình sử dụng quá mức RAM (${problem.memoryLimit || 256}MB).`);
      } else {
        setCustomOutput(data.stdout || '(Chương trình không in ra gì)');
        setCustomTime(data.time || 0);
      }
    } catch (e: any) {
      setIsRunningCustom(false);
      setCustomError('Không thể gửi lệnh chạy thử tới máy chủ: ' + e.message);
    }
  };

  // Handle Official Submission (Graded on server against secret test cases)
  const handleSubmitCode = async () => {
    flushCodeDraft();
    if (!user) {
      alert('Vui lòng đăng nhập trước khi nộp bài');
      return;
    }

    setIsSubmitting(true);
    setActiveConsoleTab('result');
    const totalExpectedTests = problem.testCount || 1;
    setJudgeProgress({ current: 0, total: totalExpectedTests, message: 'Đang gửi code lên máy chủ chấm...' });

    try {
      const res = await apiFetch(`${serverUrl}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          code,
          contestId: contestId || undefined,
          virtualSessionId: virtualSessionId || undefined
        })
      });

      if (res.ok) {
        const sub = await res.json();
        setCurrentSubmission(sub);
        if (sub.mode === 'batch') {
          setIsSubmitting(false);
          setJudgeProgress(null);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setIsSubmitting(false);
        setJudgeProgress(null);
        alert(errData.error || 'Lỗi khi gửi bài nộp');
      }
    } catch (e: any) {
      setIsSubmitting(false);
      setJudgeProgress(null);
      alert('Không thể kết nối máy chủ nộp bài: ' + e.message);
    }
  };

  const copyToClipboard = (text: string, type: 'in' | 'out', idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSampleIdx({ type, idx });
    setTimeout(() => setCopiedSampleIdx(null), 1500);
  };

  const loadSampleToCustomRun = (sampleInput: string) => {
    setCustomInput(sampleInput);
    setActiveConsoleTab('custom');
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs: number | null | undefined) => {
    if (secs === null || secs === undefined || secs < 0) return '00:00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Safe sample list (strictly from problem.samples, NEVER raw testcases)
  const samples = problem.samples || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* 1. TOP HEADER & CONTEST NAVIGATION BAR (40px) */}
      <div style={{ 
        height: '40px',
        minHeight: '40px', 
        background: 'var(--bg-surface)', 
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        gap: '8px',
        zIndex: 10
      }}>
        {/* Left: Back & Problem Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <button 
            type="button"
            className="btn btn-outline btn-sm" 
            onClick={onBack}
            style={{ fontSize: '0.76rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ChevronLeft size={14} /> Quay lại
          </button>

          {contestTitle && (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              [{contestTitle}]
            </span>
          )}

          {/* Quick Problem Switcher Tabs if in a Contest */}
          {contestProblems.length > 0 && (
            <div className="linear-tabs">
              {contestProblems.map((cp, idx) => {
                const isActive = cp.id === problem.id;
                return (
                  <button
                    key={cp.id}
                    type="button"
                    className={`linear-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectProblem && onSelectProblem(cp)}
                    style={{ padding: '2px 8px', fontSize: '0.74rem' }}
                  >
                    <span>Bài {idx + 1}: {cp.code}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({cp.points || 0}đ)</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Presets, Auto-save status, Timer & Run / Submit Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Layout Presets */}
          <div className="linear-tabs" title="Tỉ lệ chia màn hình Đề / Code (nhấp đúp thanh ngăn để về 50/50)">
            <button type="button" className={`linear-tab-btn ${splitPercent === 30 ? 'active' : ''}`} onClick={() => setSplitPercent(30)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>30/70</button>
            <button type="button" className={`linear-tab-btn ${splitPercent === 50 || splitPercent === null ? 'active' : ''}`} onClick={() => setSplitPercent(50)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>50/50</button>
            <button type="button" className={`linear-tab-btn ${splitPercent === 70 ? 'active' : ''}`} onClick={() => setSplitPercent(70)} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>70/30</button>
          </div>

          {/* Auto-save status indicator */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: isConnected ? 'var(--text-muted)' : 'var(--accent-amber)', padding: '2px 6px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isConnected ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}></span>
            <span>{isConnected ? codeSaveStatus : 'Mất mạng'}</span>
          </div>

          {/* Contest Countdown Timer */}
          {remainingSeconds !== undefined && remainingSeconds !== null && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: remainingSeconds < 300 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)',
              border: `1px solid ${remainingSeconds < 300 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)'}`,
              color: remainingSeconds < 300 ? 'var(--accent-rose)' : 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.82rem'
            }}>
              <Clock size={13} />
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          )}

          {/* Action: Custom Run */}
          <button 
            type="button"
            className="btn btn-secondary btn-sm" 
            onClick={handleRunCustom}
            disabled={isRunningCustom || isSubmitting}
            title="Chạy thử code với input bạn tự nhập (Ctrl + Enter)"
            style={{
              padding: '4px 10px',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isRunningCustom ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {isRunningCustom ? 'Đang chạy...' : 'Chạy Thử'}
          </button>

          {/* Action: Submit Official */}
          <button 
            type="button"
            className="btn btn-primary btn-sm" 
            onClick={handleSubmitCode}
            disabled={isSubmitting || isRunningCustom}
            title="Nộp bài chính thức lên máy chủ để chấm điểm"
            style={{
              padding: '4px 12px',
              fontWeight: 700,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isSubmitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            {isSubmitting ? 'Đang Chấm...' : 'Nộp Bài'}
          </button>
        </div>
      </div>

      {/* 2. MAIN SPLIT BODY: RESIZABLE SPLIT PANE */}
      <div style={{ flex: 1, height: 'calc(100% - 40px)', overflow: 'hidden' }}>
        <ResizableSplitPane
          controlledPercent={splitPercent}
          onPercentChange={() => setSplitPercent(null)}
          storageKey="schooljudge_exam_split_ratio"
          left={
            <div style={{ 
              width: '100%',
              height: '100%',
              borderRight: '1px solid var(--border-subtle)', 
              background: 'var(--bg-app)',
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Header of Problem Statement */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontFamily: 'var(--font-mono)', 
                      fontWeight: 800, 
                      fontSize: '1.1rem', 
                      color: 'var(--accent-cyan)',
                      background: 'rgba(56, 189, 248, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {problem.code}
                    </span>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      {problem.title}
                    </h2>
                  </div>
                </div>

            {/* Public Metadata Pills */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '5px', 
                fontSize: '0.78rem', 
                background: 'var(--bg-surface)', 
                padding: '4px 9px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}>
                <Clock size={13} style={{ color: 'var(--accent-amber)' }} />
                <span>Giới hạn thời gian: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{(problem.timeLimit || 1000) >= 1000 ? `${(problem.timeLimit || 1000) / 1000}s` : `${problem.timeLimit || 1000}ms`}</strong></span>
              </div>

              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '5px', 
                fontSize: '0.78rem', 
                background: 'var(--bg-surface)', 
                padding: '4px 9px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}>
                <Cpu size={13} style={{ color: 'var(--accent-cyan)' }} />
                <span>Giới hạn RAM: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{problem.memoryLimit || 256} MB</strong></span>
              </div>

              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '5px', 
                fontSize: '0.78rem', 
                background: 'var(--bg-surface)', 
                padding: '4px 9px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}>
                <Sparkles size={13} style={{ color: 'var(--primary-light)' }} />
                <span>Điểm bài: <strong style={{ color: 'var(--text-main)' }}>{problem.points || 100} điểm</strong></span>
              </div>

              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '5px', 
                fontSize: '0.78rem', 
                background: 'var(--bg-surface)', 
                padding: '4px 9px', 
                borderRadius: '6px', 
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)'
              }}>
                <Shield size={13} style={{ color: 'var(--accent-emerald)' }} />
                <span>Test chấm: <strong style={{ color: 'var(--text-main)' }}>{problem.testCount || 0} Test (Bí mật)</strong></span>
              </div>

              {contestInfo?.requireFreopen && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.78rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: 'var(--accent-amber)',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  <FileCode2 size={13} />
                  <span>Yêu cầu tệp: <strong style={{ fontFamily: 'var(--font-mono)' }}>{problem.code.toLowerCase()}.inp</strong> / <strong style={{ fontFamily: 'var(--font-mono)' }}>{problem.code.toLowerCase()}.out</strong></span>
                </div>
              )}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

          {/* Statement Content Body: Original Document or Formatted Text */}
          {hasDocFile && docFileUrl ? (
            <div style={{ minHeight: '520px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <StatementViewer 
                url={docFileUrl}
                fileName={docFileName}
                title={problem.title}
                serverUrl={serverUrl}
                height="620px"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {problem.statementHtml ? (
                <div 
                  className="problem-statement-html"
                  style={{
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                    color: '#e2e8f0'
                  }}
                  dangerouslySetInnerHTML={{ __html: problem.statementHtml }}
                />
              ) : problem.statement ? (
                <div style={{ 
                  fontSize: '0.92rem', 
                  lineHeight: 1.75, 
                  color: '#e2e8f0', 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {problem.statement}
                </div>
              ) : (
                <div style={{ 
                  fontSize: '0.92rem', 
                  lineHeight: 1.75, 
                  color: '#e2e8f0', 
                  whiteSpace: 'pre-wrap'
                }}>
                  {problem.description || '(Đề bài chưa có mô tả chi tiết)'}
                </div>
              )}
            </div>
          )}

          {/* Input / Output description if structured */}
          {problem.inputDescription && (
            <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px', textTransform: 'uppercase' }}>
                DỮ LIỆU VÀO (INPUT)
              </h4>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {problem.inputDescription}
              </div>
            </div>
          )}

          {problem.outputDescription && (
            <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '6px', textTransform: 'uppercase' }}>
                DỮ LIỆU RA (OUTPUT)
              </h4>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {problem.outputDescription}
              </div>
            </div>
          )}

          {problem.constraints && (
            <div style={{ background: 'var(--bg-surface)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '6px', textTransform: 'uppercase' }}>
                GIỚI HẠN / RÀNG BUỘC (CONSTRAINTS)
              </h4>
              <div style={{ fontSize: '0.88rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {problem.constraints}
              </div>
            </div>
          )}

          {/* VÍ DỤ MINH HỌA (SAMPLES) */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ 
                fontSize: '0.98rem', 
                fontWeight: 700, 
                color: 'var(--text-main)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                margin: 0 
              }}>
                <Code2 size={18} color="var(--primary-light)" /> VÍ DỤ MINH HỌA (SAMPLES)
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                (Bộ test chấm chính thức được bảo mật trên máy chủ)
              </span>
            </div>

            {samples.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {samples.map((sample, idx) => (
                  <div 
                    key={sample.id || idx}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Sample Card Header */}
                    <div style={{
                      background: 'var(--bg-surface-elevated)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-subtle)'
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                        {sample.name || `Ví dụ ${idx + 1}`}
                      </span>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ 
                          fontSize: '0.72rem', 
                          padding: '2px 8px', 
                          borderColor: 'var(--primary)', 
                          color: 'var(--primary-light)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => loadSampleToCustomRun(sample.input)}
                        title="Nạp dữ liệu vào ô Chạy Thử"
                      >
                        <Zap size={11} /> Nạp vào Chạy Thử
                      </button>
                    </div>

                    {/* Input & Output Blocks */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                      {/* Sample Input */}
                      <div style={{ background: 'var(--bg-surface)', padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            SAMPLE INPUT
                          </span>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: 0
                            }}
                            onClick={() => copyToClipboard(sample.input, 'in', idx)}
                            title="Chép dữ liệu Input"
                          >
                            {copiedSampleIdx?.type === 'in' && copiedSampleIdx?.idx === idx ? (
                              <>
                                <Check size={12} color="var(--accent-emerald)" />
                                <span style={{ color: 'var(--accent-emerald)' }}>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Chép Input</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.84rem',
                          color: 'var(--text-main)',
                          whiteSpace: 'pre-wrap',
                          background: '#090d16',
                          padding: '8px 10px',
                          borderRadius: '4px',
                          maxHeight: '160px',
                          overflowY: 'auto'
                        }}>
                          {sample.input || '(Trống)'}
                        </pre>
                      </div>

                      {/* Sample Output */}
                      <div style={{ background: 'var(--bg-surface)', padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                            SAMPLE OUTPUT
                          </span>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: 0
                            }}
                            onClick={() => copyToClipboard(sample.output, 'out', idx)}
                            title="Chép kết quả Output"
                          >
                            {copiedSampleIdx?.type === 'out' && copiedSampleIdx?.idx === idx ? (
                              <>
                                <Check size={12} color="var(--accent-emerald)" />
                                <span style={{ color: 'var(--accent-emerald)' }}>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Chép Output</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.84rem',
                          color: 'var(--accent-emerald)',
                          whiteSpace: 'pre-wrap',
                          background: '#090d16',
                          padding: '8px 10px',
                          borderRadius: '4px',
                          maxHeight: '160px',
                          overflowY: 'auto'
                        }}>
                          {sample.output || '(Trống)'}
                        </pre>
                      </div>
                    </div>

                    {/* Explanation if any */}
                    {sample.explanation && (
                      <div style={{ background: 'var(--bg-surface-elevated)', padding: '8px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                        <strong>Giải thích: </strong>{sample.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
                (Đề bài không có ví dụ riêng biệt, bạn có thể tự nhập input tùy ý vào ô Chạy Thử bên dưới)
              </div>
            )}
          </div>
        </div>
      }
      right={
        /* ======================================================== */
        /* RIGHT PANE: CODE EDITOR (TOP) + CONSOLE PANEL (BOTTOM)   */
        /* ======================================================== */
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Monaco Editor Container */}
          <div 
            ref={editorContainerRef}
            style={{ flex: '1 1 58%', minHeight: '260px', background: '#1e1e1e', position: 'relative' }}
          >
            <div style={{
              position: 'absolute',
              top: '6px',
              right: '14px',
              zIndex: 5,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              background: 'rgba(0,0,0,0.4)',
              padding: '2px 8px',
              borderRadius: '4px',
              pointerEvents: 'none'
            }}>
              C++ (g++ 14.2) • Tự động lưu nháp
            </div>

            <Editor
              height="100%"
              defaultLanguage="cpp"
              language="cpp"
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                roundedSelection: true,
                automaticLayout: true,
                tabSize: 4
              }}
            />
          </div>

          {/* Bottom Console Panel (Chạy Thử & Kết Quả Chấm) */}
          <div style={{ 
            flex: '1 1 42%', 
            minHeight: '220px', 
            background: 'var(--bg-surface)', 
            borderTop: '2px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Console Header Tabs */}
            <div style={{ 
              height: '40px', 
              background: 'var(--bg-surface-elevated)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '0 12px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0
            }}>
              <div className="linear-tabs">
                <button 
                  type="button"
                  className={`linear-tab-btn ${activeConsoleTab === 'custom' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('custom')}
                >
                  <Terminal size={12} /> Chạy Thử Input
                </button>

                <button 
                  type="button"
                  className={`linear-tab-btn ${activeConsoleTab === 'result' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('result')}
                >
                  <Sparkles size={12} /> Kết Quả Chấm Bài
                  {currentSubmission && (
                    <VerdictBadge status={currentSubmission.status} size="sm" showLabel={false} />
                  )}
                </button>
              </div>

              {activeConsoleTab === 'custom' && customTime !== null && (
                <div style={{ fontSize: '0.76rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  Thời gian chạy: <strong>{customTime}ms</strong>
                </div>
              )}
            </div>

            {/* TAB 1: CHẠY THỬ (CUSTOM RUN) */}
            {/* Purely accepts custom input, executes code, shows stdout / errors. NO TEST CASE COMPARISON! */}
            {activeConsoleTab === 'custom' && (
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', overflow: 'hidden' }}>
                {/* Left: Input Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      INPUT TÙY Ý (DỮ LIỆU ĐẦU VÀO)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      (Tự do nhập dữ liệu để kiểm tra code)
                    </span>
                  </div>
                  <textarea
                    className="input-field"
                    style={{ 
                      flex: 1, 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '0.85rem', 
                      resize: 'none',
                      background: '#090d16',
                      borderColor: 'var(--border-subtle)',
                      lineHeight: 1.5
                    }}
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Nhập bất kỳ dữ liệu input nào bạn muốn thử nghiệm, ví dụ:&#10;5 7&#10;100 200&#10;-10 25"
                  />
                </div>

                {/* Right: Actual Output Display */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      OUTPUT THỰC TẾ (KẾT QUẢ CHƯƠNG TRÌNH)
                    </label>
                    <button 
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRunCustom}
                      disabled={isRunningCustom || isSubmitting}
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    >
                      {isRunningCustom ? 'Đang chạy...' : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Play size={10} fill="currentColor" /> Chạy lại
                        </span>
                      )}
                    </button>
                  </div>
                  <div style={{ 
                    flex: 1, 
                    background: '#090d16', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    overflowY: 'auto'
                  }}>
                    {isRunningCustom ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', padding: '10px 0' }}>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Đang biên dịch và thực thi chương trình...</span>
                      </div>
                    ) : customError ? (
                      <pre style={{ color: 'var(--accent-rose)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {customError}
                      </pre>
                    ) : customOutput ? (
                      <pre style={{ color: '#f8fafc', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {customOutput}
                      </pre>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>
                        Chưa có kết quả. Nhập input ở bên trái rồi bấm <strong>"Chạy Thử"</strong> để thực thi chương trình!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: KẾT QUẢ CHẤM BÀI (OFFICIAL SUBMISSION ONLY) */}
            {activeConsoleTab === 'result' && (
              <div style={{ flex: 1, padding: '14px 18px', overflowY: 'auto' }}>
                {judgeProgress && (
                  <div style={{ marginBottom: '14px', background: 'rgba(99, 102, 241, 0.1)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <RefreshCw size={15} className="animate-spin" style={{ color: 'var(--primary-light)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{judgeProgress.message}</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${judgeProgress.total ? (judgeProgress.current / judgeProgress.total) * 100 : 30}%`, 
                        background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 100%)',
                        transition: 'width 200ms ease'
                      }} />
                    </div>
                  </div>
                )}

                {currentSubmission ? (
                  <div>
                    {/* Verdict Summary Header */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: 'var(--bg-surface-elevated)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '14px',
                      border: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <VerdictBadge status={currentSubmission.status} size="lg" />
                        <div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            Điểm: <span style={{ color: 'var(--accent-emerald)' }}>{currentSubmission.score}</span> / {problem.points || 100} điểm
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Đã vượt qua: <strong>{currentSubmission.passedTests}/{currentSubmission.totalTests}</strong> test case
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '18px', fontFamily: 'var(--font-mono)', fontSize: '0.84rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Thời gian: </span>
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{currentSubmission.executionTime || 0}ms</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Bộ nhớ: </span>
                          <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{currentSubmission.memoryUsed || 0} KB</span>
                        </div>
                      </div>
                    </div>

                    {/* Compilation Error Display */}
                    {currentSubmission.compileError && (
                      <div style={{ 
                        background: 'rgba(244, 63, 94, 0.08)', 
                        border: '1px solid rgba(244, 63, 94, 0.3)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '12px',
                        marginBottom: '14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                          <AlertCircle size={15} /> THÔNG BÁO LỖI BIÊN DỊCH (COMPILATION ERROR)
                        </div>
                        <pre style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '0.82rem', 
                          color: '#fca5a5', 
                          whiteSpace: 'pre-wrap', 
                          margin: 0,
                          maxHeight: '180px',
                          overflowY: 'auto'
                        }}>
                          {currentSubmission.compileError}
                        </pre>
                      </div>
                    )}

                    {/* Test Case Status Grid: Test results without leaking secret inputs/outputs */}
                    {currentSubmission.details && currentSubmission.details.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            KẾT QUẢ TỪNG TEST CASE ({currentSubmission.passedTests}/{currentSubmission.totalTests} ĐẠT)
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            (Nội dung file test chấm chính thức được bảo mật trên máy chủ)
                          </span>
                        </div>

                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                          gap: '8px' 
                        }}>
                          {currentSubmission.details.map((detail, idx) => {
                            const isPassed = detail.status === 'AC';
                            const testIndex = detail.testIndex || (idx + 1);
                            return (
                              <div
                                key={idx}
                                style={{
                                  background: 'var(--bg-app)',
                                  border: `1px solid ${isPassed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: isPassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                    color: isPassed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                                    fontWeight: 800,
                                    fontSize: '0.8rem'
                                  }}>
                                    {isPassed ? '✓' : '✗'}
                                  </span>
                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      Test {String(testIndex).padStart(2, '0')}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      {detail.time || 0}ms • {detail.scoreEarned || 0}đ
                                    </div>
                                  </div>
                                </div>

                                <VerdictBadge status={detail.status} size="sm" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Batch mode message */}
                    {currentSubmission.status === 'QUEUED' && (
                      <div style={{ marginTop: '14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                        <strong style={{ color: 'var(--accent-cyan)', display: 'block', fontSize: '0.86rem', marginBottom: '2px' }}>
                          Đã thu bài thành công
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Hệ thống đang hoạt động ở chế độ thu bài. Kết quả chính thức sẽ được công bố khi giáo viên kết thúc thời gian thi.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Chưa có bài nộp nào cho bài toán này. Hãy viết code và bấm <strong>"Nộp Bài Chấm Điểm"</strong>!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      }
    />
  </div>
</div>
);
};
