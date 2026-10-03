import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Contest, LeaderboardEntry, Problem, ClassGroup } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Trophy, 
  RefreshCw, 
  Filter, 
  Search, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const [contests, setContests] = useState<Contest[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [contestProblems, setContestProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Filters for Contests List
  const [searchContest, setSearchContest] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'ended' | 'upcoming'>('all');

  // Filter for Inside Contest Leaderboard
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  useEffect(() => {
    fetchInitialData();
  }, [serverUrl]);

  useEffect(() => {
    if (!selectedContest) return;

    fetchContestLeaderboard(selectedContest.id);

    if (socket) {
      const handleLeaderboardUpdate = (data: any) => {
        if (!data || !selectedContest) return;
        // If update is for this contest or general
        if (Array.isArray(data)) {
          setLeaderboard(data);
        } else if (data.contestId === selectedContest.id && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      };

      socket.on('leaderboard:update', handleLeaderboardUpdate);
      socket.on(`contest:${selectedContest.id}:leaderboard`, handleLeaderboardUpdate);

      return () => {
        socket.off('leaderboard:update', handleLeaderboardUpdate);
        socket.off(`contest:${selectedContest.id}:leaderboard`, handleLeaderboardUpdate);
      };
    }
  }, [selectedContest, serverUrl, socket]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [contestRes, classRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/contests`),
        apiFetch(`${serverUrl}/api/classes`)
      ]);
      if (contestRes.ok) {
        const contestData: Contest[] = await contestRes.json();
        setContests(contestData);
      }
      if (classRes.ok) {
        const classData: ClassGroup[] = await classRes.json();
        setClasses(classData);
      }
    } catch (e) {
      console.error('Error fetching contests:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchContestLeaderboard = async (contestId: string) => {
    try {
      setLoadingLeaderboard(true);
      const [lbRes, probRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/contests/${contestId}/leaderboard`),
        apiFetch(`${serverUrl}/api/problems`)
      ]);

      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setLeaderboard(Array.isArray(lbData) ? lbData : []);
      }

      if (probRes.ok) {
        const allProbs: Problem[] = await probRes.json();
        const contest = contests.find(c => c.id === contestId);
        if (contest && contest.problemIds) {
          const filtered = allProbs.filter(p => contest.problemIds.includes(p.id));
          setContestProblems(filtered);
        } else {
          setContestProblems(allProbs);
        }
      }
    } catch (e) {
      console.error('Error fetching contest leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const getContestStatus = (contest: Contest): 'running' | 'upcoming' | 'ended' => {
    const now = Date.now();
    const start = new Date(contest.startTime).getTime();
    const end = new Date(contest.endTime).getTime();
    if (now < start) return 'upcoming';
    if (now > end || contest.status === 'ended') return 'ended';
    return 'running';
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'midterm': return 'Giữa kỳ';
      case 'final': return 'Cuối kỳ';
      case 'regular': return 'Thường xuyên';
      case 'practice': return 'Luyện tập';
      case 'olympic': return 'Olympic';
      case 'hsg': return 'Thi HSG';
      default: return 'Kỳ thi chung';
    }
  };

  // Filtered contests list
  const filteredContests = contests.filter(c => {
    if (searchContest.trim()) {
      const q = searchContest.toLowerCase().trim();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchDesc = (c.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (categoryFilter !== 'all' && (c.category || 'regular') !== categoryFilter) {
      return false;
    }
    if (statusFilter !== 'all') {
      const status = getContestStatus(c);
      if (status !== statusFilter) return false;
    }
    return true;
  });

  // Filtered entries by class
  const filteredLeaderboard = leaderboard.filter(entry => {
    if (selectedClass === 'ALL') return true;
    return entry.classId === selectedClass;
  });

  const top3 = filteredLeaderboard.slice(0, 3);

  // ==================== SCREEN 1: CONTEST SELECTION ====================
  if (!selectedContest) {
    return (
      <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={28} style={{ color: '#fbbf24' }} />
              <h2 style={{ fontSize: '1.45rem', margin: 0 }}>Bảng Xếp Hạng Kỳ Thi</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
              Chọn một kỳ thi để xem thứ hạng, điểm số và bài giải chi tiết của các thí sinh
            </p>
          </div>

          <button
            className="btn btn-outline"
            onClick={fetchInitialData}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới danh sách
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '22px', padding: '14px 18px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Tìm kỳ thi theo tên hoặc nội dung..."
              value={searchContest}
              onChange={e => setSearchContest(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Phân loại:</span>
            <select
              className="input-field"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="all">Tất cả phân loại</option>
              <option value="regular">Thường xuyên</option>
              <option value="midterm">Giữa kỳ</option>
              <option value="final">Cuối kỳ</option>
              <option value="practice">Luyện tập</option>
              <option value="olympic">Olympic</option>
              <option value="hsg">Học sinh giỏi</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Trạng thái:</span>
            <select
              className="input-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              style={{ minWidth: '140px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="running">🟢 Đang diễn ra</option>
              <option value="upcoming">🟡 Upcoming</option>
              <option value="ended">⚪ Ended</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Tìm thấy <strong>{filteredContests.length}</strong> kỳ thi
          </div>
        </div>

        {/* Contests Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '12px' }} />
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>Đang tải danh sách kỳ thi...</div>
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Trophy size={42} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.4 }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>
              Không có kỳ thi nào phù hợp
            </h3>
            <p style={{ fontSize: '0.85rem' }}>
              Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc phân loại/trạng thái.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredContests.map(c => {
              const status = getContestStatus(c);
              const statusBadge = status === 'running' 
                ? { label: 'Đang diễn ra', bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: 'rgba(16, 185, 129, 0.3)' }
                : status === 'upcoming'
                ? { label: 'Upcoming', bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', border: 'rgba(245, 158, 11, 0.3)' }
                : { label: 'Ended', bg: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-muted)', border: 'rgba(148, 163, 184, 0.3)' };

              return (
                <div
                  key={c.id}
                  className="glass-card card-hover"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onClick={() => setSelectedContest(c)}
                >
                  <div>
                    {/* Header tags */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span
                        className="badge"
                        style={{
                          background: statusBadge.bg,
                          color: statusBadge.color,
                          border: `1px solid ${statusBadge.border}`,
                          fontWeight: 700,
                          fontSize: '0.72rem'
                        }}
                      >
                        {statusBadge.label}
                      </span>

                      <span
                        className="badge badge-secondary"
                        style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      >
                        {getCategoryLabel(c.category)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text-main)', lineHeight: 1.3 }}>
                      {c.title}
                    </h3>

                    {c.description && (
                      <p style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '14px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {c.description}
                      </p>
                    )}

                    {/* Details Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} />
                        <span>Thời lượng: <strong>{c.durationMinutes || 45} phút</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={13} />
                        <span>Số bài tập: <strong>{c.problemIds?.length || 0} bài</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} />
                        <span>{new Date(c.startTime).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '0.85rem'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedContest(c);
                    }}
                  >
                    <Trophy size={16} /> Xem Bảng Xếp Hạng <ChevronRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==================== SCREEN 2: CONTEST SPECIFIC LEADERBOARD ====================
  const status = getContestStatus(selectedContest);

  return (
    <div style={{ flex: 1, padding: '24px 36px', overflowY: 'auto' }}>
      {/* Top Navigation & Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          className="btn btn-outline"
          onClick={() => setSelectedContest(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}
        >
          <ArrowLeft size={16} /> Quay lại danh sách kỳ thi
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick contest switcher */}
          <select
            className="input-field"
            value={selectedContest.id}
            onChange={e => {
              const next = contests.find(c => c.id === e.target.value);
              if (next) setSelectedContest(next);
            }}
            style={{ fontSize: '0.84rem', minWidth: '220px' }}
          >
            {contests.map(c => (
              <option key={c.id} value={c.id}>
                🏆 {c.title}
              </option>
            ))}
          </select>

          {/* Filter by Class */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input-field"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              style={{ fontSize: '0.84rem', minWidth: '150px' }}
            >
              <option value="ALL">Tất cả các lớp</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => fetchContestLeaderboard(selectedContest.id)}
            disabled={loadingLeaderboard}
            title="Làm mới bảng xếp hạng"
          >
            <RefreshCw size={15} className={loadingLeaderboard ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Contest Header Card */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Trophy size={24} style={{ color: '#fbbf24' }} />
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{selectedContest.title}</h2>
              <span className="badge badge-secondary" style={{ fontSize: '0.74rem' }}>
                {getCategoryLabel(selectedContest.category)}
              </span>
              <span className={`badge ${status === 'running' ? 'badge-primary' : 'badge-outline'}`} style={{ fontSize: '0.74rem' }}>
                {status === 'running' ? '🟢 Đang diễn ra' : status === 'upcoming' ? '🟡 Upcoming' : '⚪ Ended'}
              </span>
            </div>
            {selectedContest.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                {selectedContest.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>TỔNG THÍ SINH</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {filteredLeaderboard.length}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>TỔNG ĐIỂM ĐỀ</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {selectedContest.totalScore || 100}đ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Podium Top 3 */}
      {top3.length >= 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {top3.map((entry, idx) => {
            const medalColors = [
              { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)', label: 'HẠNG 1 (VÀNG)', icon: '🥇' },
              { color: '#cbd5e1', bg: 'rgba(203, 213, 225, 0.1)', border: 'rgba(203, 213, 225, 0.3)', label: 'HẠNG 2 (BẠC)', icon: '🥈' },
              { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', label: 'HẠNG 3 (ĐỒNG)', icon: '🥉' }
            ][idx] || { color: 'var(--primary)', bg: 'transparent', border: 'var(--border-subtle)', label: `HẠNG ${idx + 1}`, icon: '🎖️' };

            const classObj = classes.find(c => c.id === entry.classId);

            return (
              <div
                key={entry.userId}
                className="glass-card"
                style={{
                  background: medalColors.bg,
                  borderColor: medalColors.border,
                  textAlign: 'center',
                  padding: '20px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ fontSize: '2.2rem', marginBottom: '4px' }}>{medalColors.icon}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: medalColors.color, letterSpacing: '0.05em' }}>
                  {medalColors.label}
                </div>
                <h3 style={{ fontSize: '1.15rem', marginTop: '6px', marginBottom: '4px' }}>
                  {entry.userName}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {classObj?.name || entry.classId || `@${entry.username}`}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {entry.totalScore} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>điểm</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', marginTop: '4px' }}>
                  Giải được {entry.problemsSolved} bài tập
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Leaderboard Table */}
      {loadingLeaderboard ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
          <div>Đang tải kết quả thi...</div>
        </div>
      ) : filteredLeaderboard.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Trophy size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <div>Chưa có bài nộp nào cho kỳ thi này.</div>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '14px 18px', width: '70px', textAlign: 'center' }}>HẠNG</th>
                <th style={{ padding: '14px 18px' }}>HỌC SINH</th>
                <th style={{ padding: '14px 18px', width: '120px' }}>LỚP</th>
                <th style={{ padding: '14px 18px', textAlign: 'center', width: '110px' }}>TỔNG ĐIỂM</th>
                <th style={{ padding: '14px 18px', textAlign: 'center', width: '100px' }}>SỐ BÀI AC</th>
                {contestProblems.map(p => (
                  <th key={p.id} style={{ padding: '14px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    {p.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.map((entry, idx) => {
                const classObj = classes.find(c => c.id === entry.classId);
                return (
                  <tr key={entry.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                    <td style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'center' }}>
                      {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600 }}>{entry.userName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{entry.username}</div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {classObj?.name || entry.classId || 'Tự do'}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                      {entry.totalScore}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {entry.problemsSolved}
                    </td>
                    {contestProblems.map(p => {
                      const probResult = entry.solvedProblems ? entry.solvedProblems[p.id] : null;
                      return (
                        <td key={p.id} style={{ padding: '14px 14px', textAlign: 'center' }}>
                          {probResult ? (
                            <span style={{ 
                              padding: '3px 8px', 
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: probResult.status === 'AC' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                              color: probResult.status === 'AC' ? 'var(--verdict-ac)' : 'var(--verdict-wa)',
                              border: `1px solid ${probResult.status === 'AC' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                            }}>
                              {probResult.score}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
