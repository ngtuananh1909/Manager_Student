import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Problem } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Code2, 
  Clock, 
  Cpu, 
  ChevronRight, 
  CheckCircle2, 
  Trophy, 
  AlertCircle,
  Sparkles,
  Flame
} from 'lucide-react';

interface Props {
  onSelectProblem: (problem: Problem) => void;
}

export const StudentDashboard: React.FC<Props> = ({ onSelectProblem }) => {
  const { serverUrl, socket } = useNetwork();
  const { user } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');

  useEffect(() => {
    fetchProblems();

    if (socket) {
      socket.on('problems:update', fetchProblems);
      socket.on('problems:delete', fetchProblems);
      return () => {
        socket.off('problems:update', fetchProblems);
        socket.off('problems:delete', fetchProblems);
      };
    }
  }, [serverUrl, socket]);

  const fetchProblems = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/problems`);
      if (res.ok) {
        const data = await res.json();
        setProblems(data);
      }
    } catch (e) {
      console.error('Failed to load problems:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredProblems = problems.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDiff = selectedDifficulty === 'ALL' || p.difficulty === selectedDifficulty;
    return matchesSearch && matchesDiff;
  });

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto', background: 'var(--bg-app)' }}>
      {/* Hero Welcome Banner */}
      <div className="glass-panel" style={{ 
        padding: '24px 32px', 
        marginBottom: '28px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>👋</span>
            <h2 style={{ fontSize: '1.4rem' }}>
              Xin chào, <span style={{ color: 'var(--accent-cyan)' }}>{user?.fullName || 'Học sinh'}</span>!
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '600px' }}>
            Hệ thống chấm bài C++ nội bộ trường học. Hãy chọn một bài tập dưới đây, viết code trực tiếp trên IDE và nộp bài để nhận phản hồi tự động.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '110px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              {problems.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG BÀI TẬP</div>
          </div>
          <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '110px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Flame size={20} fill="#f59e0b" color="#f59e0b" /> {user?.streak || 5}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>NGÀY STREAK</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <div style={{ position: 'relative', width: '340px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '38px' }}
            placeholder="Tìm theo tên bài hoặc mã bài (vd: SUM_AB)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'Dễ', 'Trung bình', 'Khó'].map((diff) => (
            <button
              key={diff}
              className={`btn btn-sm ${selectedDifficulty === diff ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedDifficulty(diff)}
            >
              {diff === 'ALL' ? 'Tất cả mức độ' : diff}
            </button>
          ))}
        </div>
      </div>

      {/* Problem Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Đang tải danh sách bài tập từ máy chủ...
        </div>
      ) : filteredProblems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Không tìm thấy bài tập nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {filteredProblems.map((prob) => (
            <div 
              key={prob.id} 
              className="glass-card"
              style={{ 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => onSelectProblem(prob)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.8rem', 
                    fontWeight: 700, 
                    color: 'var(--accent-cyan)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    {prob.code}
                  </span>
                  <span className={`badge ${
                    prob.difficulty === 'Dễ' ? 'diff-tag-easy' : 
                    prob.difficulty === 'Trung bình' ? 'diff-tag-medium' : 'diff-tag-hard'
                  }`}>
                    {prob.difficulty}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', marginBottom: '8px', color: 'var(--text-main)' }}>
                  {prob.title}
                </h3>

                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {prob.description.replace(/[#*`]/g, '')}
                </p>
              </div>

              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> {prob.timeLimit}ms
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={13} /> {prob.memoryLimit}MB
                    </span>
                  </div>

                  <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    {prob.points} điểm
                  </span>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '12px', padding: '7px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProblem(prob);
                  }}
                >
                  <Code2 size={15} /> Làm Bài Ngay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
