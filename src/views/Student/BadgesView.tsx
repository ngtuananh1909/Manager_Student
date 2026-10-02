import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { apiFetch } from '../../lib/api';
import { Achievement, Reward, RewardRedemption, StudentAchievement } from '../../types';
import { 
  Trophy, 
  Gift, 
  Flame, 
  Star, 
  CheckCircle2, 
  Lock, 
  Search, 
  Filter, 
  RefreshCw, 
  ShoppingBag, 
  Clock, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const BadgesView: React.FC = () => {
  const { user } = useAuth();
  const { serverUrl, socket } = useNetwork();

  const [activeTab, setActiveTab] = useState<'achievements' | 'shop' | 'history'>('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [studentAchievements, setStudentAchievements] = useState<StudentAchievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myRedemptions, setMyRedemptions] = useState<RewardRedemption[]>([]);
  const [myPoints, setMyPoints] = useState<number>(user?.points || 0);
  const [loading, setLoading] = useState(true);

  // Filter states for achievements
  const [searchAch, setSearchAch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNLOCKED' | 'LOCKED'>('ALL');

  // Redemption in progress
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    if (socket) {
      const handleUnlocked = (item: any) => {
        if (item && item.achievementId) {
          setStudentAchievements(prev => {
            if (prev.some(sa => sa.achievementId === item.achievementId)) return prev;
            return [...prev, item];
          });
          // Refresh points
          fetchData();
        }
      };

      socket.on('achievement:unlocked', handleUnlocked);
      return () => {
        socket.off('achievement:unlocked', handleUnlocked);
      };
    }
  }, [serverUrl, socket]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [achRes, myAchRes, rewRes, redRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/achievements`),
        apiFetch(`${serverUrl}/api/student/achievements`),
        apiFetch(`${serverUrl}/api/rewards`),
        apiFetch(`${serverUrl}/api/rewards/redemptions`)
      ]);

      if (achRes.ok) {
        const achList: Achievement[] = await achRes.json();
        setAchievements(achList);
      }
      if (myAchRes.ok) {
        const myData = await myAchRes.json();
        setStudentAchievements(myData.earned || []);
        if (myData.points !== undefined) {
          setMyPoints(myData.points);
        }
      }
      if (rewRes.ok) {
        const rewList: Reward[] = await rewRes.json();
        setRewards(rewList);
      }
      if (redRes.ok) {
        const redList: RewardRedemption[] = await redRes.json();
        setMyRedemptions(redList);
      }
    } catch (e) {
      console.error('Error fetching gamification data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (myPoints < reward.pointsRequired) {
      alert(`Bạn cần thêm ${reward.pointsRequired - myPoints} điểm để đổi ${reward.name}`);
      return;
    }
    if (reward.stock <= 0) {
      alert('Phần thưởng này hiện đã hết hàng trong kho!');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn dùng ${reward.pointsRequired} điểm để đổi "${reward.name}"?`)) {
      return;
    }

    try {
      setRedeemingRewardId(reward.id);
      const res = await apiFetch(`${serverUrl}/api/rewards/${reward.id}/redeem`, {
        method: 'POST'
      });

      if (res.ok) {
        const result = await res.json();
        alert(`🎉 Đổi quà "${reward.name}" thành công! Vui lòng liên hệ Thầy/Cô quản trị để nhận quà.`);
        setMyPoints(result.remainingPoints);
        setMyRedemptions(prev => [result.redemption, ...prev]);
        setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, stock: Math.max(0, r.stock - 1) } : r));
      } else {
        const err = await res.json();
        alert(`Không thể đổi quà: ${err.error || 'Lỗi xử lý'}`);
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    } finally {
      setRedeemingRewardId(null);
    }
  };

  const unlockedIds = new Set(studentAchievements.map(sa => sa.achievementId));

  const filteredAchievements = achievements.filter(ach => {
    if (!ach.isActive) return false;
    const isUnlocked = unlockedIds.has(ach.id);

    if (statusFilter === 'UNLOCKED' && !isUnlocked) return false;
    if (statusFilter === 'LOCKED' && isUnlocked) return false;

    if (categoryFilter !== 'ALL' && ach.category !== categoryFilter) {
      return false;
    }

    if (searchAch.trim()) {
      const q = searchAch.toLowerCase().trim();
      const matchName = (ach.name || '').toLowerCase().includes(q);
      const matchDesc = (ach.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }

    return true;
  });

  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY': return { label: 'Huyền Thoại', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'EPIC': return { label: 'Sử Thi', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' };
      case 'RARE': return { label: 'Hiếm', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' };
      default: return { label: 'Phổ Thông', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.2)' };
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Top Banner Stats */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Trophy size={28} style={{ color: '#fbbf24' }} />
              <h2 style={{ fontSize: '1.45rem', margin: 0 }}>Huy Hiệu & Đổi Quà Thưởng</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Thu thập hơn 100 thành tựu lập trình để tích lũy điểm thưởng và đổi các phần quà thực tế
            </p>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {/* Points balance */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 179, 8, 0.1))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 20px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-amber)', fontWeight: 700, letterSpacing: '0.04em' }}>
                ĐIỂM TÍCH LŨY
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Star size={20} fill="#fbbf24" color="#fbbf24" /> {myPoints}
              </div>
            </div>

            {/* Achievements progress */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 20px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                ĐÃ MỞ KHÓA
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {unlockedIds.size} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {achievements.length}</span>
              </div>
            </div>

            {/* Streak */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 20px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                CHUỖI LIÊN TỤC
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Flame size={20} color="#f97316" /> {user?.streak || 0}d
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '22px' }}>
        <button
          className={`btn ${activeTab === 'achievements' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('achievements')}
        >
          <Trophy size={16} /> Thành Tựu ({unlockedIds.size}/{achievements.length})
        </button>

        <button
          className={`btn ${activeTab === 'shop' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('shop')}
        >
          <Gift size={16} /> Cửa Hàng Đổi Quà ({rewards.filter(r => r.isActive).length})
        </button>

        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={16} /> Lịch Sử Đổi Quà ({myRedemptions.length})
        </button>
      </div>

      {/* TAB 1: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <div>
          {/* Filters Bar */}
          <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '12px 18px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="🔍 Tìm kiếm thành tựu..."
                value={searchAch}
                onChange={e => setSearchAch(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Chủ đề:</span>
              <select
                className="input-field"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{ minWidth: '150px' }}
              >
                <option value="ALL">Tất cả chủ đề</option>
                <option value="BEGINNER">Người mới bắt đầu</option>
                <option value="PROBLEM_SOLVING">Giải bài tập</option>
                <option value="CONTEST">Kỳ thi & Olympic</option>
                <option value="STREAK">Chuỗi hoạt động</option>
                <option value="SPEED">Tốc độ & Tối ưu</option>
                <option value="ACCURACY">Độ chính xác</option>
                <option value="DEDICATION">Chăm chỉ</option>
                <option value="SPECIAL">Đặc biệt</option>
                <option value="MASTERY">Bậc thầy</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Trạng thái:</span>
              <select
                className="input-field"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ minWidth: '140px' }}
              >
                <option value="ALL">Tất cả</option>
                <option value="UNLOCKED">🟢 Đã đạt được</option>
                <option value="LOCKED">🔒 Chưa mở khóa</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Hiển thị <strong>{filteredAchievements.length}</strong> thành tựu
            </div>
          </div>

          {/* Achievements Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
              <div>Đang tải bảng thành tích...</div>
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
              <Trophy size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <div>Không tìm thấy thành tựu nào phù hợp với bộ lọc.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '16px' }}>
              {filteredAchievements.map(ach => {
                const isUnlocked = unlockedIds.has(ach.id);
                const rarity = getRarityConfig(ach.rarity);

                return (
                  <div
                    key={ach.id}
                    className="glass-card"
                    style={{
                      background: isUnlocked ? rarity.bg : 'var(--bg-surface)',
                      borderColor: isUnlocked ? rarity.border : 'var(--border-subtle)',
                      opacity: isUnlocked ? 1 : 0.65,
                      padding: '18px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Icon container */}
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        minWidth: '52px',
                        borderRadius: '12px',
                        background: isUnlocked ? 'var(--bg-surface-elevated)' : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        boxShadow: isUnlocked ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {ach.icon || '🏆'}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span
                          className="badge"
                          style={{
                            background: rarity.bg,
                            color: rarity.color,
                            border: `1px solid ${rarity.border}`,
                            fontSize: '0.68rem',
                            fontWeight: 700
                          }}
                        >
                          {rarity.label}
                        </span>

                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24' }}>
                          +{ach.points}đ
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.98rem', margin: '2px 0 4px 0', color: isUnlocked ? 'var(--text-main)' : 'var(--text-secondary)' }}>
                        {ach.name}
                      </h4>

                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.35 }}>
                        {ach.description}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                        {isUnlocked ? (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Đã hoàn thành
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Lock size={12} /> Chưa mở khóa
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {ach.code}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REWARDS SHOP */}
      {activeTab === 'shop' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
            {rewards.filter(r => r.isActive).map(reward => {
              const canAfford = myPoints >= reward.pointsRequired;
              const hasStock = reward.stock > 0;
              const isRedeeming = redeemingRewardId === reward.id;

              return (
                <div
                  key={reward.id}
                  className="glass-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '22px',
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontSize: '2.8rem' }}>{reward.icon || '🎁'}</span>
                      <span
                        className={`badge ${hasStock ? 'badge-primary' : 'badge-outline'}`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {hasStock ? `Còn ${reward.stock} cái` : 'Hết hàng'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                      {reward.name}
                    </h3>

                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '38px', lineHeight: 1.4 }}>
                      {reward.description || 'Phần thưởng trao tay trực tiếp cho các bạn học sinh có kết quả học tập xuất sắc.'}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '18px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>
                        ⭐ {reward.pointsRequired}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>điểm</span>
                    </div>
                  </div>

                  <button
                    className={`btn ${canAfford && hasStock ? 'btn-primary' : 'btn-outline'}`}
                    disabled={!canAfford || !hasStock || isRedeeming}
                    onClick={() => handleRedeemReward(reward)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px'
                    }}
                  >
                    <ShoppingBag size={16} />
                    {isRedeeming
                      ? 'Đang đổi...'
                      : !hasStock
                      ? 'Tạm hết hàng'
                      : !canAfford
                      ? `Thiếu ${reward.pointsRequired - myPoints} điểm`
                      : 'Đổi phần thưởng ngay'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REDEMPTION HISTORY */}
      {activeTab === 'history' && (
        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Icon</th>
                <th>Phần Thưởng Đã Đổi</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Điểm Trừ</th>
                <th style={{ width: '180px' }}>Thời Gian Yêu Cầu</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Trạng Thái</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Hướng Dẫn</th>
              </tr>
            </thead>
            <tbody>
              {myRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    Bạn chưa đổi phần thưởng nào. Hãy tích lũy điểm từ các bài tập và kỳ thi nhé!
                  </td>
                </tr>
              ) : (
                myRedemptions.map(r => {
                  const statusBadge = r.status === 'CLAIMED'
                    ? { label: 'Đã nhận quà', color: 'var(--accent-emerald)', desc: 'Hoàn tất' }
                    : r.status === 'APPROVED'
                    ? { label: 'Đã được duyệt', color: 'var(--accent-cyan)', desc: 'Gặp Thầy/Cô để nhận' }
                    : r.status === 'REJECTED'
                    ? { label: 'Bị từ chối', color: 'var(--verdict-wa)', desc: 'Đã hoàn điểm lại' }
                    : { label: 'Chờ duyệt', color: 'var(--accent-amber)', desc: 'Đang xử lý' };

                  return (
                    <tr key={r.id} className="data-table-row">
                      <td style={{ textAlign: 'center', fontSize: '1.4rem' }}>{r.rewardIcon || '🎁'}</td>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{r.rewardName}</strong>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-amber)' }}>
                        -{r.pointsSpent}đ
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(r.requestedAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: statusBadge.color, fontWeight: 700, fontSize: '0.8rem' }}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {statusBadge.desc}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
