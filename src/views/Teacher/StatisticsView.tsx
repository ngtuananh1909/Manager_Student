import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Problem, Submission, Contest, ClassGroup, ContestReport } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  PieChart, 
  Users, 
  Trophy, 
  Clock, 
  Layers, 
  Filter, 
  FileText, 
  FileCheck, 
  FileSpreadsheet, 
  Printer, 
  X, 
  Search, 
  ChevronRight,
  ShieldCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const StatisticsView: React.FC = () => {
  const { serverUrl } = useNetwork();

  // Navigation sub-tabs inside Statistics
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'submissions' | 'reports'>('overview');

  // Core Data
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Submission Filters
  const [selectedContestId, setSelectedContestId] = useState<string>('all');
  const [participationFilter, setParticipationFilter] = useState<'ALL' | 'REAL' | 'VIRTUAL'>('ALL');
  const [problemFilter, setProblemFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState<string>('');

  // Official Report Modal
  const [officialReportModal, setOfficialReportModal] = useState<ContestReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetchData();
  }, [serverUrl]);

  const fetchData = async () => {
    try {
      const [probRes, subRes, contestRes, classRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/problems?role=host`),
        apiFetch(`${serverUrl}/api/submissions`),
        apiFetch(`${serverUrl}/api/contests?role=host`),
        apiFetch(`${serverUrl}/api/classes`)
      ]);
      if (probRes.ok) setProblems(await probRes.json());
      if (subRes.ok) setSubmissions(await subRes.json());
      if (contestRes.ok) setContests(await contestRes.json());
      if (classRes.ok) setClasses(await classRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open(`${serverUrl}/api/export/csv`, '_blank');
  };

  const handleOpenReport = async (contestId: string) => {
    setLoadingReport(true);
    try {
      const res = await apiFetch(`${serverUrl}/api/contests/${contestId}/official-report`);
      if (res.ok) {
        const data = await res.json();
        setOfficialReportModal(data);
      } else {
        alert('Chưa thể xuất bảng điểm: Kỳ thi chưa có dữ liệu hợp lệ.');
      }
    } catch (e: any) {
      alert('Lỗi kết nối máy chủ: ' + e.message);
    } finally {
      setLoadingReport(false);
    }
  };

  // Map classId to name
  const classMap: Record<string, string> = {};
  classes.forEach(c => { classMap[c.id] = c.name; });

  // Map contestId to Contest
  const contestMap: Record<string, Contest> = {};
  contests.forEach(c => { contestMap[c.id] = c; });

  // Filter submissions
  const filteredSubmissions = submissions.filter(sub => {
    // Contest filter
    if (selectedContestId !== 'all') {
      if (sub.contestId !== selectedContestId) return false;
    }

    // Participation Type filter: REAL vs VIRTUAL
    const isVirtual = sub.isVirtual || sub.participationType === 'VIRTUAL';
    if (participationFilter === 'REAL' && isVirtual) return false;
    if (participationFilter === 'VIRTUAL' && !isVirtual) return false;

    // Problem filter
    if (problemFilter !== 'all') {
      if (sub.problemId !== problemFilter && sub.problemCode !== problemFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (sub.status !== statusFilter) return false;
    }

    // Student Search filter
    if (searchStudent.trim()) {
      const q = searchStudent.toLowerCase();
      const matchName = (sub.userName || '').toLowerCase().includes(q);
      const matchUser = (sub.userId || '').toLowerCase().includes(q);
      if (!matchName && !matchUser) return false;
    }

    return true;
  });

  // Compute metrics based on REAL submissions
  const realSubs = submissions.filter(s => !s.isVirtual && s.participationType !== 'VIRTUAL');
  const virtualSubs = submissions.filter(s => !!s.isVirtual || s.participationType === 'VIRTUAL');

  const totalSubs = submissions.length;
  const acSubs = realSubs.filter(s => s.status === 'AC').length;
  const waSubs = realSubs.filter(s => s.status === 'WA').length;
  const tleSubs = realSubs.filter(s => s.status === 'TLE').length;
  const acRate = realSubs.length > 0 ? Math.round((acSubs / realSubs.length) * 100) : 0;

  // Stats per problem
  const probStats = problems.map(prob => {
    const pSubs = realSubs.filter(s => s.problemId === prob.id || s.problemCode === prob.code);
    const pAC = pSubs.filter(s => s.status === 'AC').length;
    const pWA = pSubs.filter(s => s.status === 'WA').length;
    const pTLE = pSubs.filter(s => s.status === 'TLE').length;
    const rate = pSubs.length > 0 ? Math.round((pAC / pSubs.length) * 100) : 0;
    return {
      ...prob,
      total: pSubs.length,
      ac: pAC,
      wa: pWA,
      tle: pTLE,
      rate
    };
  });

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* 1. Header with title & sub-navigation tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={26} style={{ color: 'var(--primary-light)' }} />
            <h2 style={{ fontSize: '1.45rem', margin: 0 }}>📊 Trung Tâm Thống Kê & Báo Cáo Kỳ Thi</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '4px' }}>
            Phân tích số liệu bài nộp theo từng kỳ thi, phân biệt rõ ràng <strong>Tham Gia Thật (REAL)</strong> và <strong>Tham Gia Ảo (VIRTUAL)</strong>, xuất báo cáo điểm chuẩn.
          </p>
        </div>

        {/* Sub-Tabs Button Group & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            type="button" 
            className="btn btn-outline btn-sm" 
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Làm mới dữ liệu thống kê từ máy chủ"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm Mới
          </button>

          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-medium)', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              onClick={() => setActiveSubTab('overview')}
            >
              <TrendingUp size={14} /> Tổng Quan
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'submissions' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              onClick={() => setActiveSubTab('submissions')}
            >
              <Layers size={14} /> Submissions Các Kỳ Thi ({submissions.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeSubTab === 'reports' ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              onClick={() => setActiveSubTab('reports')}
            >
              <FileCheck size={14} /> Bảng Điểm Báo Cáo
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUB-TAB 1: TỔNG QUAN (OVERVIEW) */}
      {activeSubTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div className="glass-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                BÀI NỘP CHÍNH THỨC (REAL)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {realSubs.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} /> Dùng tính điểm kỳ thi
              </div>
            </div>

            <div className="glass-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                BÀI NỘP ẢO / LUYỆN TẬP
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                {virtualSubs.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Không đưa vào bảng điểm
              </div>
            </div>

            <div className="glass-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                TỶ LỆ ACCEPTED (AC)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                {acRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {acSubs} lượt chấm đạt tối đa
              </div>
            </div>

            <div className="glass-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                WRONG ANSWER (WA)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '4px' }}>
                {waSubs}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Sai testcase chính thức
              </div>
            </div>

            <div className="glass-card">
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                TIME LIMIT (TLE)
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '4px' }}>
                {tleSubs}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Vượt quá thời gian chạy
              </div>
            </div>
          </div>

          {/* Breakdown per Problem Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>TỶ LỆ HOÀN THÀNH THEO TỪNG BÀI TOÁN (CHÍNH THỨC)</span>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleExportCSV}
                title="Tải bảng điểm tổng hợp định dạng CSV/Excel"
                style={{ fontSize: '0.76rem' }}
              >
                <Download size={13} /> Xuất Báo Cáo Tổng Hợp (CSV)
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 18px' }}>MÃ BÀI</th>
                  <th style={{ padding: '12px 18px' }}>TIÊU ĐỀ BÀI TOÁN</th>
                  <th style={{ padding: '12px 18px' }}>MỨC ĐỘ</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>SỐ BÀI NỘP</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>SỐ LƯỢT AC</th>
                  <th style={{ padding: '12px 18px', width: '220px' }}>TỶ LỆ AC (%)</th>
                </tr>
              </thead>
              <tbody>
                {probStats.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {p.code}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600 }}>{p.title}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span className={`badge ${
                        p.difficulty === 'Dễ' ? 'diff-tag-easy' : 
                        p.difficulty === 'Trung bình' ? 'diff-tag-medium' : 'diff-tag-hard'
                      }`}>
                        {p.difficulty}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {p.total}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      {p.ac}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '8px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${p.rate}%`, 
                            background: p.rate >= 70 ? 'var(--accent-emerald)' : p.rate >= 40 ? 'var(--accent-amber)' : 'var(--accent-rose)' 
                          }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: '38px' }}>
                          {p.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 3. SUB-TAB 2: SUBMISSIONS CÁC KỲ THI (LỌC THEO KỲ THI & LOẠI THAM GIA) */}
      {activeSubTab === 'submissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Contest Selector Bar */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trophy size={16} color="var(--primary-light)" /> CHỌN KỲ THI ĐỂ XEM SUBMISSION:
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${selectedContestId === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                onClick={() => setSelectedContestId('all')}
              >
                Tất cả kỳ thi ({contests.length})
              </button>

              {contests.map(c => {
                const cSubs = submissions.filter(s => s.contestId === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn btn-sm ${selectedContestId === c.id ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    onClick={() => setSelectedContestId(c.id)}
                  >
                    {c.title} ({cSubs.length} sub)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters Bar: Participation Type, Problem, Status, Student */}
          <div className="glass-panel" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Filter: Loại tham gia */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  LOẠI THAM GIA:
                </label>
                <select 
                  className="input-field" 
                  style={{ fontSize: '0.8rem', padding: '4px 10px', height: '32px' }}
                  value={participationFilter}
                  onChange={(e: any) => setParticipationFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả bài nộp</option>
                  <option value="REAL">✓ Tham gia chính thức (REAL)</option>
                  <option value="VIRTUAL">○ Tham gia ảo / Thi thử (VIRTUAL)</option>
                </select>
              </div>

              {/* Filter: Bài toán */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  BÀI TOÁN:
                </label>
                <select 
                  className="input-field" 
                  style={{ fontSize: '0.8rem', padding: '4px 10px', height: '32px' }}
                  value={problemFilter}
                  onChange={(e) => setProblemFilter(e.target.value)}
                >
                  <option value="all">Tất cả bài</option>
                  {problems.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.title}</option>
                  ))}
                </select>
              </div>

              {/* Filter: Trạng thái */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  KẾT QUẢ:
                </label>
                <select 
                  className="input-field" 
                  style={{ fontSize: '0.8rem', padding: '4px 10px', height: '32px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="AC">AC (Đạt tối đa)</option>
                  <option value="WA">WA (Sai kết quả)</option>
                  <option value="TLE">TLE (Quá thời gian)</option>
                  <option value="MLE">MLE (Quá bộ nhớ)</option>
                  <option value="CE">CE (Lỗi biên dịch)</option>
                </select>
              </div>

              {/* Filter: Search student */}
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  TÌM THÍ SINH:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ fontSize: '0.8rem', padding: '4px 10px 4px 28px', height: '32px', width: '180px' }}
                    placeholder="Họ tên thí sinh..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Hiển thị <strong>{filteredSubmissions.length}</strong> / {submissions.length} bài nộp
            </div>
          </div>

          {/* Submissions Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px' }}>THỜI GIAN</th>
                  <th style={{ padding: '12px 14px' }}>HỌ VÀ TÊN</th>
                  <th style={{ padding: '12px 14px' }}>KỲ THI</th>
                  <th style={{ padding: '12px 14px' }}>BÀI TOÁN</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>NGÔN NGỮ</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>KẾT QUẢ</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>ĐIỂM</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>LOẠI THI</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy bài nộp nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map(sub => {
                    const isVirt = !!sub.isVirtual || sub.participationType === 'VIRTUAL';
                    const cTitle = sub.contestId && contestMap[sub.contestId] ? contestMap[sub.contestId].title : 'Tự do';
                    return (
                      <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(sub.submittedAt).toLocaleTimeString('vi-VN')} {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {sub.userName}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>@{sub.userId}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {cTitle}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            [{sub.problemCode}]
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          C++11
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span className={`badge ${
                            sub.status === 'AC' ? 'diff-tag-easy' : 
                            sub.status === 'WA' ? 'diff-tag-hard' : 'diff-tag-medium'
                          }`} style={{ fontWeight: 800 }}>
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: sub.score > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                          {sub.score}đ
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {isVirt ? (
                            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.72rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              ○ Thi ảo
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.72rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              ✓ Thật
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 3: BẢNG ĐIỂM BÁO CÁO CÁC KỲ THI */}
      {activeSubTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileCheck size={20} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Danh Sách Bảng Điểm Kỳ Thi Để Xuất Báo Cáo</h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Theo quy định, bảng điểm báo cáo chỉ tổng hợp thí sinh <strong>Tham gia chính thức (REAL)</strong>, gồm đúng 4 cột: <strong>STT | HỌ VÀ TÊN | LỚP | ĐIỂM</strong> để nộp phòng đào tạo hoặc in bảng điểm lưu trữ.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {contests.map(c => {
              const cSubs = submissions.filter(s => s.contestId === c.id);
              const realCSubs = cSubs.filter(s => !s.isVirtual && s.participationType !== 'VIRTUAL');
              return (
                <div key={c.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className={`badge ${c.status === 'running' ? 'diff-tag-easy' : c.status === 'upcoming' ? 'diff-tag-medium' : ''}`}>
                        {c.status === 'running' ? 'Đang diễn ra' : c.status === 'upcoming' ? 'Sắp mở' : 'Đã kết thúc'}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {c.durationMinutes} phút
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {c.title}
                    </h4>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                      • Số bài thi: <strong>{c.problemIds?.length || 0} bài</strong><br />
                      • Bài nộp chính thức: <strong>{realCSubs.length} bài</strong><br />
                      • Tổng điểm kỳ thi: <strong>{c.totalScore || 100} điểm</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 700 }}
                      onClick={() => handleOpenReport(c.id)}
                    >
                      <FileCheck size={14} /> Tạo Bảng Điểm
                    </button>
                    <a
                      href={`${serverUrl}/api/contests/${c.id}/export-official-csv`}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      title="Xuất trực tiếp file Excel"
                    >
                      <FileSpreadsheet size={14} color="var(--accent-emerald)" /> Excel
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MODAL: XEM & IN BẢNG ĐIỂM CHÍNH THỨC */}
      {officialReportModal && (
        <div className="modal-overlay" onClick={() => setOfficialReportModal(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '26px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Print & Export actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={22} style={{ color: 'var(--accent-emerald)' }} />
                  <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                    BẢNG ĐIỂM BÁO CÁO KỲ THI
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Kỳ thi: <strong>{officialReportModal.contestTitle}</strong> • Chỉ tính thí sinh <strong>Tham gia chính thức (REAL)</strong>, loại bỏ bài thi ảo
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={`${serverUrl}/api/contests/${officialReportModal.contestId}/export-official-csv`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', textDecoration: 'none' }}
                  title="Xuất bảng điểm ra file Excel / CSV"
                >
                  <FileSpreadsheet size={14} color="var(--accent-emerald)" /> Xuất Excel
                </a>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      alert('Vui lòng cho phép mở cửa sổ popup để in bảng điểm!');
                      return;
                    }
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <title>Bảng Điểm - ${officialReportModal.contestTitle}</title>
                        <meta charset="utf-8" />
                        <style>
                          body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #000; }
                          .header { text-align: center; margin-bottom: 24px; }
                          .header h3 { margin: 0 0 4px 0; text-transform: uppercase; font-size: 14pt; }
                          .header h2 { margin: 0 0 6px 0; text-transform: uppercase; font-size: 18pt; font-weight: bold; }
                          .header p { margin: 0; font-size: 11pt; font-style: italic; }
                          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                          th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12pt; text-align: left; }
                          th { background: #f2f2f2; text-align: center; font-weight: bold; }
                          .center { text-align: center; }
                          .footer { margin-top: 50px; display: flex; justify-content: flex-end; }
                          .footer-sign { text-align: center; font-size: 12pt; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h3>TRƯỜNG TH-THCS-THPT TRÍ ĐỨC</h3>
                          <h2>BẢNG ĐIỂM KỲ THI</h2>
                          <h3>${officialReportModal.contestTitle}</h3>
                          <p>Thời gian: ${new Date().toLocaleDateString('vi-VN')} | Tổng số thí sinh: ${officialReportModal.rows?.length || 0}</p>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 10%;">STT</th>
                              <th style="width: 50%;">HỌ VÀ TÊN</th>
                              <th style="width: 20%;">LỚP</th>
                              <th style="width: 20%;">ĐIỂM</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${(officialReportModal.rows || []).map((r: any) => `
                              <tr>
                                <td class="center">${r.stt}</td>
                                <td><strong>${r.fullName}</strong></td>
                                <td class="center">${r.className}</td>
                                <td class="center" style="font-weight: bold;">${r.score}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <div class="footer">
                          <div class="footer-sign">
                            <p style="font-style: italic; margin-bottom: 40px;">Ngày ...... tháng ...... năm 20...</p>
                            <p><strong>NGƯỜI LẬP BẢNG</strong></p>
                            <p style="margin-top: 50px;">(Ký và ghi rõ họ tên)</p>
                          </div>
                        </div>
                        <script>
                          window.onload = function() { window.print(); }
                        </script>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}
                  title="In trực tiếp hoặc Lưu dưới dạng PDF"
                >
                  <Printer size={14} /> In / Xuất PDF
                </button>

                <button className="btn btn-outline btn-sm" onClick={() => setOfficialReportModal(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Document sheet view */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff', color: '#0f172a', padding: '28px 32px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: '#475569', textTransform: 'uppercase' }}>
                  TRƯỜNG TH-THCS-THPT TRÍ ĐỨC
                </div>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '6px 0', color: '#0f172a', textTransform: 'uppercase' }}>
                  BẢNG ĐIỂM KỲ THI
                </h2>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1d4ed8' }}>
                  {officialReportModal.contestTitle}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                  Thời gian: {new Date().toLocaleDateString('vi-VN')} • Xếp loại điểm chính thức
                </div>
              </div>

              {(!officialReportModal.rows || officialReportModal.rows.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.9rem' }}>
                  Chưa có thí sinh chính thức nào tham gia hoặc nộp bài trong kỳ thi này.
                </div>
              ) : (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#1e293b' }}>
                        <th style={{ padding: '10px 14px', width: '12%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>STT</th>
                        <th style={{ padding: '10px 14px', width: '48%', border: '1px solid #cbd5e1', fontWeight: 700 }}>HỌ VÀ TÊN</th>
                        <th style={{ padding: '10px 14px', width: '20%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>LỚP</th>
                        <th style={{ padding: '10px 14px', width: '20%', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 700 }}>ĐIỂM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialReportModal.rows.map((row: any) => (
                        <tr key={row.stt} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 600, color: '#475569' }}>
                            {row.stt}
                          </td>
                          <td style={{ padding: '9px 12px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f172a' }}>
                            {row.fullName}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#334155' }}>
                            {row.className}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', border: '1px solid #cbd5e1', fontWeight: 800, color: '#059669', fontSize: '1rem' }}>
                            {row.score}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center', fontSize: '0.88rem', color: '#334155', minWidth: '220px' }}>
                      <div style={{ fontStyle: 'italic', marginBottom: '40px', color: '#64748b' }}>
                        Ngày ...... tháng ...... năm 20...
                      </div>
                      <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                        Người lập bảng
                      </div>
                      <div style={{ marginTop: '50px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        (Ký và ghi rõ họ tên)
                      </div>
                    </div>
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
