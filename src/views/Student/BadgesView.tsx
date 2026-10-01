import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Award, Zap, Target, Flame, Bug, CheckCircle2, Lock } from 'lucide-react';

export const BadgesView: React.FC = () => {
  const { user } = useAuth();
  const unlockedBadges = new Set(user?.badges || ['FIRST_BLOOD', 'SPEED_DEMON']);

  const allBadges = [
    {
      id: 'FIRST_BLOOD',
      name: 'Chiến Tích Đầu Tiên (First Blood)',
      description: 'Học sinh đầu tiên trong phòng máy giải được một bài tập',
      icon: <Award size={32} color="#fbbf24" />,
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.1)',
      border: 'rgba(251, 191, 36, 0.25)'
    },
    {
      id: 'SPEED_DEMON',
      name: 'Thần Tốc (Speed Demon)',
      description: 'Thuật toán tối ưu cực hạn có thời gian chạy dưới 15ms',
      icon: <Zap size={32} color="#06b6d4" />,
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.1)',
      border: 'rgba(6, 182, 212, 0.25)'
    },
    {
      id: 'PERFECTIONIST',
      name: 'Hoàn Hảo (Perfectionist)',
      description: 'Đạt 100/100 điểm tuyệt đối ngay trong lần nộp bài đầu tiên',
      icon: <Target size={32} color="#10b981" />,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)'
    },
    {
      id: 'CODE_NINJA',
      name: 'Chuỗi Luyện Tập (Streak 7 Ngày)',
      description: 'Duy trì chuỗi nộp bài liên tục 7 ngày trên hệ thống',
      icon: <Flame size={32} color="#f59e0b" />,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.25)'
    },
    {
      id: 'BUG_HUNTER',
      name: 'Thợ Săn Bẫy (Trap Master)',
      description: 'Vượt qua bài tập có test bẫy tràn số hoặc biên cực đại',
      icon: <Bug size={32} color="#a855f7" />,
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.1)',
      border: 'rgba(168, 85, 247, 0.25)'
    },
    {
      id: 'CLEAN_CODER',
      name: 'Code Chuẩn Không Cần Chỉnh',
      description: 'Nộp 5 bài liên tiếp không mắc bất kỳ lỗi biên dịch nào',
      icon: <CheckCircle2 size={32} color="#38bdf8" />,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.1)',
      border: 'rgba(56, 189, 248, 0.25)'
    }
  ];

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Huy Hiệu & Thành Tích Học Tập</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Mở khoá các huy hiệu vinh danh khi bạn đạt các cột mốc lập trình xuất sắc
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
        {allBadges.map((badge) => {
          const isUnlocked = unlockedBadges.has(badge.id);

          return (
            <div 
              key={badge.id}
              className="glass-card"
              style={{ 
                background: isUnlocked ? badge.bg : 'var(--bg-surface)',
                borderColor: isUnlocked ? badge.border : 'var(--border-subtle)',
                opacity: isUnlocked ? 1 : 0.65,
                position: 'relative',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                padding: '20px'
              }}
            >
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '14px', 
                background: isUnlocked ? 'var(--bg-surface-elevated)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isUnlocked ? badge.icon : <Lock size={26} color="var(--text-muted)" />}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1rem', color: isUnlocked ? 'var(--text-main)' : 'var(--text-secondary)' }}>
                    {badge.name}
                  </h3>
                  {isUnlocked && (
                    <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      ĐÃ ĐẠT
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {badge.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
