import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { useNetwork } from '../../context/NetworkContext';
import { useAuth } from '../../context/AuthContext';
import { VerdictBadge } from '../../components/VerdictBadge';
import { 
  Swords, 
  Flame, 
  Trophy, 
  Clock, 
  Shield, 
  Zap, 
  Play, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  RotateCw, 
  Search, 
  Award,
  ChevronRight,
  Sparkles,
  Flag
} from 'lucide-react';

interface ArenaProfile {
  userId: string;
  username: string;
  fullName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  fullName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  winRate: number;
}

interface ActiveMatch {
  matchId: string;
  status: 'RUNNING' | 'FINISHED';
  startTime: number;
  endTime: number;
  remainingSeconds: number;
  problem: {
    id: string;
    code: string;
    title: string;
    timeLimit: number;
    memoryLimit: number;
    description: string;
    samples: any[];
  };
  me: {
    userId: string;
    username: string;
    fullName: string;
    rating: number;
    score: number;
    submissionsCount: number;
    bestStatus: string;
  };
  opponent: {
    userId: string;
    username: string;
    fullName: string;
    rating: number;
    score: number;
    submissionsCount: number;
    bestStatus: string;
    isBot?: boolean;
  };
}

interface GameOverSummary {
  matchId: string;
  winnerId: string | null;
  winReason: string;
  player1: any;
  player2: any;
}

const DEFAULT_ARENA_CPP = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Viết code thi đấu tốc độ ở đây!
    
    return 0;
}
`;

export const ArenaTournamentView: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const { user } = useAuth();

  // Arena State
  const [profile, setProfile] = useState<ArenaProfile>({
    userId: '',
    username: '',
    fullName: '',
    rating: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [inQueue, setInQueue] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  // Active Match State
  const [match, setMatch] = useState<ActiveMatch | null>(null);
  const [code, setCode] = useState(DEFAULT_ARENA_CPP);
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<any>(null);
  const [gameOver, setGameOver] = useState<GameOverSummary | null>(null);

  // Timer Ref
  const queueTimerRef = useRef<any>(null);

  useEffect(() => {
    fetchProfile();
    fetchLeaderboard();
    checkActiveMatch();
  }, [serverUrl]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleQueueStatus = (data: { inQueue: boolean }) => {
      setInQueue(data.inQueue);
      if (!data.inQueue) {
        setQueueTime(0);
        clearInterval(queueTimerRef.current);
      }
    };

    const handleMatchStart = (matchData: ActiveMatch) => {
      setInQueue(false);
      setQueueTime(0);
      clearInterval(queueTimerRef.current);
      setMatch(matchData);
      setCode(DEFAULT_ARENA_CPP);
      setSubmitFeedback(null);
      setGameOver(null);
    };

    const handleTimerTick = (data: { remainingSeconds: number }) => {
      setMatch(prev => prev ? ({ ...prev, remainingSeconds: data.remainingSeconds }) : null);
    };

    const handleOpponentUpdate = (data: { opponentScore: number; opponentStatus: string; opponentSubmissions: number }) => {
      setMatch(prev => {
        if (!prev) return null;
        return {
          ...prev,
          opponent: {
            ...prev.opponent,
            score: data.opponentScore,
            bestStatus: data.opponentStatus,
            submissionsCount: data.opponentSubmissions
          }
        };
      });
    };

    const handleMyResult = (result: any) => {
      setSubmitting(false);
      setSubmitFeedback(result);
      setMatch(prev => {
        if (!prev) return null;
        return {
          ...prev,
          me: {
            ...prev.me,
            score: Math.max(prev.me.score, result.score),
            bestStatus: result.status,
            submissionsCount: prev.me.submissionsCount + 1
          }
        };
      });
    };

    const handleGameOver = (summary: GameOverSummary) => {
      setSubmitting(false);
      setGameOver(summary);
      fetchProfile();
      fetchLeaderboard();
    };

    const handleReconnect = (matchData: ActiveMatch) => {
      setMatch(matchData);
    };

    socket.on('arena:queue_status', handleQueueStatus);
    socket.on('arena:match_start', handleMatchStart);
    socket.on('arena:timer_tick', handleTimerTick);
    socket.on('arena:opponent_update', handleOpponentUpdate);
    socket.on('arena:my_submission_result', handleMyResult);
    socket.on('arena:match_over', handleGameOver);
    socket.on('arena:reconnect', handleReconnect);

    return () => {
      socket.off('arena:queue_status', handleQueueStatus);
      socket.off('arena:match_start', handleMatchStart);
      socket.off('arena:timer_tick', handleTimerTick);
      socket.off('arena:opponent_update', handleOpponentUpdate);
      socket.off('arena:my_submission_result', handleMyResult);
      socket.off('arena:match_over', handleGameOver);
      socket.off('arena:reconnect', handleReconnect);
    };
  }, [socket]);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/arena/profile`);
      if (res.ok) setProfile(await res.json());
    } catch (e) {}
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/arena/leaderboard`);
      if (res.ok) setLeaderboard(await res.json());
    } catch (e) {}
  };

  const checkActiveMatch = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/arena/active-match`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveMatch && data.match) {
          setMatch(data.match);
        }
      }
    } catch (e) {}
  };

  const handleJoinQueue = () => {
    if (!socket) return;
    socket.emit('arena:join_queue');
    setInQueue(true);
    setQueueTime(0);
    queueTimerRef.current = setInterval(() => {
      setQueueTime(t => t + 1);
    }, 1000);
  };

  const handleLeaveQueue = () => {
    if (!socket) return;
    socket.emit('arena:leave_queue');
    setInQueue(false);
    setQueueTime(0);
    clearInterval(queueTimerRef.current);
  };

  const handleSubmitCode = () => {
    if (!socket || !match || submitting) return;
    if (!code.trim()) {
      alert('Vui lòng nhập code C++ trước khi nộp');
      return;
    }
    setSubmitting(true);
    socket.emit('arena:submit', { matchId: match.matchId, code });
  };

  const handleSurrender = () => {
    if (!confirm('Bạn có chắc chắn muốn xin đầu hàng trận đấu này?')) return;
    if (!socket || !match) return;
    socket.emit('arena:surrender', { matchId: match.matchId });
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Rank Badge based on rating
  const getRankBadge = (rating: number) => {
    if (rating >= 1800) return { name: 'Đại Cao Thủ (Grandmaster)', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' };
    if (rating >= 1500) return { name: 'Kim Cương (Diamond)', color: 'var(--accent-cyan)', bg: 'rgba(56,189,248,0.15)' };
    if (rating >= 1350) return { name: 'Bạch Kim (Platinum)', color: 'var(--accent-emerald)', bg: 'rgba(34,197,94,0.15)' };
    if (rating >= 1200) return { name: 'Vàng (Gold)', color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.15)' };
    return { name: 'Bạc (Silver)', color: 'var(--text-secondary)', bg: 'var(--bg-surface-elevated)' };
  };

  const myRank = getRankBadge(profile.rating || 1200);

  // ─── ACTIVE MATCH BATTLE ARENA ────────────────────────────────────────────
  if (match) {
    const isUrgent = (match.remainingSeconds || 900) < 120; // less than 2 mins
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Battle Duel Header Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '10px 24px', 
          background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)', 
          borderBottom: '1px solid var(--border-medium)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Player 1 (You) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              BẠN
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {user?.fullName || user?.username}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.78rem', marginTop: '2px' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>Điểm: {match.me.score}đ</span>
                <span style={{ color: 'var(--text-muted)' }}>• Nộp: {match.me.submissionsCount}</span>
                {match.me.bestStatus && <VerdictBadge status={match.me.bestStatus as any} size="sm" />}
              </div>
            </div>
          </div>

          {/* Center Cyber Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ 
              fontSize: '1.6rem', 
              fontWeight: 900, 
              fontFamily: 'var(--font-mono)', 
              color: isUrgent ? 'var(--accent-rose)' : 'var(--accent-amber)',
              textShadow: isUrgent ? '0 0 12px rgba(244, 63, 94, 0.6)' : '0 0 10px rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Clock size={20} /> {formatSeconds(match.remainingSeconds)}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ FIRST AC HOẶC ĐIỂM CAO HƠN THẮNG
            </div>
          </div>

          {/* Player 2 (Opponent) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                {match.opponent.fullName}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', fontSize: '0.78rem', marginTop: '2px' }}>
                {match.opponent.bestStatus && <VerdictBadge status={match.opponent.bestStatus as any} size="sm" />}
                <span style={{ color: 'var(--text-muted)' }}>Nộp: {match.opponent.submissionsCount} •</span>
                <span style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>Điểm: {match.opponent.score}đ</span>
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid var(--accent-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--accent-rose)' }}>
              ĐỐI THỦ
            </div>
          </div>
        </div>

        {/* Duel Workspace Split */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
          {/* Left: Problem Statement */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-medium)', background: 'var(--bg-app)', overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
                  [{match.problem.code}]
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {match.problem.title}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px', fontFamily: 'var(--font-mono)' }}>
              <span>⏱ Time Limit: {match.problem.timeLimit}ms</span>
              <span>•</span>
              <span>💾 Memory Limit: {match.problem.memoryLimit}MB</span>
            </div>

            <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-main)', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
              {match.problem.description || 'Giải thuật toán bài này và nộp code C++ để đạt 100 điểm AC trước đối thủ!'}
            </div>

            {/* Samples */}
            {match.problem.samples && match.problem.samples.length > 0 && (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  TEST MẪU (SAMPLES):
                </div>
                {match.problem.samples.map((s, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                      {s.name || `Ví dụ #${idx + 1}`}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>INPUT:</div>
                        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                          {s.input}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OUTPUT:</div>
                        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                          {s.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Code Editor & Submission Action */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#252526', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9cdcfe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={14} /> duel_solution.cpp
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={handleSurrender}
                  style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.3)', padding: '4px 10px', fontSize: '0.76rem' }}
                  title="Đầu hàng trận đấu"
                >
                  <Flag size={12} /> Đầu Hàng
                </button>

                <button 
                  className="btn btn-primary"
                  onClick={handleSubmitCode}
                  disabled={submitting}
                  style={{ padding: '6px 20px', fontWeight: 800, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Play size={14} fill={submitting ? 'none' : 'currentColor'} />
                  {submitting ? 'Đang Chấm...' : 'Nộp Bài Chấm'}
                </button>
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

            {/* Quick Result Feedback Banner */}
            {submitFeedback && (
              <div style={{ 
                padding: '12px 18px', 
                background: submitFeedback.score === 100 ? 'rgba(34, 197, 94, 0.18)' : 'rgba(30, 41, 59, 0.95)', 
                borderTop: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <VerdictBadge status={submitFeedback.status} size="sm" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: submitFeedback.score === 100 ? 'var(--accent-emerald)' : 'var(--text-main)' }}>
                    {submitFeedback.score} / 100 Điểm
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    ({submitFeedback.passedTests}/{submitFeedback.totalTests} tests • {submitFeedback.executionTime}ms)
                  </span>
                </div>

                {submitFeedback.score === 100 && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={14} /> KNOCKOUT VICTORY!
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Game Over Victory / Defeat Modal */}
        {gameOver && (
          <div className="modal-overlay">
            <div 
              className="glass-panel" 
              style={{ 
                width: '100%', 
                maxWidth: '520px', 
                padding: '30px', 
                textAlign: 'center',
                border: gameOver.winnerId === user?.id 
                  ? '2px solid var(--accent-emerald)' 
                  : gameOver.winnerId === null 
                  ? '2px solid var(--accent-amber)' 
                  : '2px solid var(--accent-rose)'
              }}
            >
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                margin: '0 auto 16px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: gameOver.winnerId === user?.id 
                  ? 'rgba(34, 197, 94, 0.2)' 
                  : gameOver.winnerId === null 
                  ? 'rgba(245, 158, 11, 0.2)' 
                  : 'rgba(244, 63, 94, 0.2)',
                color: gameOver.winnerId === user?.id 
                  ? 'var(--accent-emerald)' 
                  : gameOver.winnerId === null 
                  ? 'var(--accent-amber)' 
                  : 'var(--accent-rose)'
              }}>
                {gameOver.winnerId === user?.id ? <Trophy size={32} /> : gameOver.winnerId === null ? <Sparkles size={32} /> : <AlertCircle size={32} />}
              </div>

              <h2 style={{ 
                fontSize: '1.8rem', 
                fontWeight: 900, 
                margin: '0 0 6px 0',
                color: gameOver.winnerId === user?.id 
                  ? 'var(--accent-emerald)' 
                  : gameOver.winnerId === null 
                  ? 'var(--accent-amber)' 
                  : 'var(--accent-rose)'
              }}>
                {gameOver.winnerId === user?.id ? '🎉 CHIẾN THẮNG (VICTORY)!' : gameOver.winnerId === null ? '🤝 HÒA (DRAW)!' : '💀 THẤT BẠI (DEFEAT)'}
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 20px 0' }}>
                {gameOver.winReason === 'KNOCKOUT_AC' ? 'Chiến thắng Knockout bằng cách đạt 100 điểm AC trước!' :
                 gameOver.winReason === 'HIGHEST_SCORE' ? 'Hết 15 phút - Chiến thắng nhờ tổng điểm cao hơn đối thủ!' :
                 gameOver.winReason === 'SURRENDER' ? 'Đối thủ đã xin đầu hàng trận đấu!' : 'Hết 15 phút - Hai bên kết thúc với kết quả hòa!'}
              </p>

              {/* Rating Delta */}
              <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '24px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>THAY ĐỔI RATING</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: gameOver.winnerId === user?.id ? 'var(--accent-emerald)' : 'var(--text-main)', marginTop: '2px' }}>
                    {gameOver.winnerId === user?.id ? '+25 Elo' : gameOver.winnerId === null ? '+10 Elo' : '-15 Elo'}
                  </div>
                </div>

                <div style={{ width: '1px', height: '36px', background: 'var(--border-subtle)' }} />

                <div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ĐIỂM TÍCH LŨY</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
                    {gameOver.winnerId === user?.id ? '+30 Điểm' : '+10 Điểm'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary"
                  style={{ padding: '8px 24px', fontWeight: 700 }}
                  onClick={() => {
                    setMatch(null);
                    setGameOver(null);
                  }}
                >
                  Quay Lại Sảnh Đấu Trường
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── ARENA LOBBY & LEADERBOARD ────────────────────────────────────────────
  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Swords size={24} color="var(--accent-rose)" /> Đấu Trường 1v1 - Swiss Tournament Arena
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Chế độ giải trí thi đấu trực tiếp 15 phút. Người đầu tiên đạt AC hoặc người có điểm cao nhất khi hết giờ sẽ giành chiến thắng!
          </p>
        </div>
      </div>

      {/* Duelist Profile & Matchmaking Hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '28px' }}>
        {/* Matchmaking Action Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Flame size={20} color="var(--accent-rose)" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-rose)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MATCHMAKING BATTLEGROUND
              </span>
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
              Thách Đấu Thuật Toán 15 Phút
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Hệ thống sẽ bốc ngẫu nhiên 1 bài tập từ kho đề và ghép cặp bạn với đối thủ cùng trình độ. First AC (100đ) kết liễu trận đấu ngay lập tức!
            </p>
          </div>

          <div>
            {inQueue ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid var(--accent-cyan)', padding: '12px 18px', borderRadius: 'var(--radius-sm)' }}>
                  <RotateCw size={18} className="animate-spin" color="var(--accent-cyan)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      Đang tìm kiếm đối thủ...
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Thời gian chờ: {queueTime}s (tự động ghép bot AI nếu lâu hơn 10s)
                    </div>
                  </div>
                </div>

                <button 
                  className="btn btn-outline"
                  onClick={handleLeaveQueue}
                  style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--accent-rose)' }}
                >
                  Hủy Tìm Trận
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={handleJoinQueue}
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  fontSize: '1.05rem', 
                  fontWeight: 900, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px',
                  background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)'
                }}
              >
                <Swords size={20} /> TÌM ĐỐI THỦ THI ĐẤU NGAY
              </button>
            )}
          </div>
        </div>

        {/* User Arena Profile Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
              HỒ SƠ ĐẤU THỦ CỦA BẠN
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: myRank.bg, border: `2px solid ${myRank.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={26} color={myRank.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {profile.fullName || user?.fullName}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: myRank.color, marginTop: '2px' }}>
                  {myRank.name} • {profile.rating} Elo
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>THẮNG</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>{profile.wins}</div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HÒA</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>{profile.draws}</div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>THUA</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '2px' }}>{profile.losses}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>Tỉ lệ thắng: <strong>{profile.winRate}%</strong></span>
            <span>Tổng trận: <strong>{profile.wins + profile.losses + profile.draws}</strong></span>
          </div>
        </div>
      </div>

      {/* Swiss Arena Leaderboard */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Trophy size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
            Bảng Xếp Hạng Đấu Sĩ Toàn Trường (Swiss Stage)
          </h3>
        </div>

        {leaderboard.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Chưa có trận đấu nào được ghi nhận. Hãy là người đầu tiên thách đấu!
          </div>
        ) : (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '14px 18px', width: '70px' }}>HẠNG</th>
                  <th style={{ padding: '14px 18px' }}>ĐẤU THỦ</th>
                  <th style={{ padding: '14px 18px', width: '140px' }}>ELO RATING</th>
                  <th style={{ padding: '14px 18px', width: '120px' }}>THẮNG / THUA</th>
                  <th style={{ padding: '14px 18px', width: '110px' }}>TỈ LỆ THẮNG</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((u, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <tr 
                      key={u.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: u.id === user?.id ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '14px 18px', fontWeight: 800 }}>
                        {isTop3 ? (
                          <span style={{ 
                            color: rank === 1 ? 'var(--accent-amber)' : rank === 2 ? '#cbd5e1' : '#f97316',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            #{rank}
                          </span>
                        ) : `#${rank}`}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {u.fullName || u.username} {u.id === user?.id && <span style={{ color: 'var(--accent-cyan)', fontSize: '0.78rem' }}>(Bạn)</span>}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-amber)' }}>
                        {u.rating}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{u.wins}W</span> - <span style={{ color: 'var(--accent-rose)' }}>{u.losses}L</span>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                        {u.winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
