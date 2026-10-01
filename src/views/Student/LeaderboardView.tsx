import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { LeaderboardEntry, Problem } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { Trophy, Medal, Award, Flame, RefreshCw, Sparkles, Filter } from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  useEffect(() => {
    fetchData();

    if (socket) {
      socket.on('leaderboard:update', (updated: LeaderboardEntry[]) => {
        setLeaderboard(updated);
      });
      return () => {
        socket.off('leaderboard:update');
      };
    }
  }, [serverUrl, socket]);

  const fetchData = async () => {
    try {
      const [lbRes, probRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/leaderboard`),
        apiFetch(`${serverUrl}/api/problems?role=user`)
      ]);
      if (lbRes.ok) setLeaderboard(await lbRes.json());
      if (probRes.ok) setProblems(await probRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = leaderboard.filter(entry => {
    if (selectedClass === 'ALL') return true;
    return entry.classId === selectedClass;
  });

  const top3 = filtered.slice(0, 3);

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Title & Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={24} style={{ color: '#fbbf24' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Bảng Xếp Hạng Trực Tiếp</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Cập nhật thời gian thực điểm số và thứ hạng của học sinh qua mạng LAN
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select 
            className="input-field" 
            style={{ width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="ALL">Tất cả các lớp</option>
            <option value="cls-1">Lớp 10 Tin Học</option>
            <option value="cls-2">Lớp 11 Chuyên Toán-Tin</option>
            <option value="cls-3">CLB Lập Trình Thi Đấu</option>
          </select>
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
                  @{entry.username}
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

      {/* Main Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '14px 18px', width: '70px' }}>HẠNG</th>
              <th style={{ padding: '14px 18px' }}>HỌC SINH</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>TỔNG ĐIỂM</th>
              <th style={{ padding: '14px 18px', textAlign: 'center' }}>SỐ BÀI AC</th>
              {problems.map(p => (
                <th key={p.id} style={{ padding: '14px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  {p.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, idx) => (
              <tr 
                key={entry.userId}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                  {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ fontWeight: 600 }}>{entry.userName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{entry.username}</div>
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                  {entry.totalScore}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {entry.problemsSolved}
                </td>
                {problems.map(p => {
                  const probResult = entry.solvedProblems[p.id];
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
