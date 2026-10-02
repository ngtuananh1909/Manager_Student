import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Achievement, Reward, RewardRedemption, AchievementRarity, AchievementConditionType } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Trophy, 
  Gift, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Sparkles, 
  Check, 
  X,
  Package,
  ListOrdered
} from 'lucide-react';

export const AchievementsManager: React.FC = () => {
  const { serverUrl, socket } = useNetwork();
  const [activeTab, setActiveTab] = useState<'achievements' | 'rewards' | 'redemptions'>('achievements');
  
  // Data states
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);

  // Achievement Filter & Pagination states
  const [achSearch, setAchSearch] = useState('');
  const [achCategoryFilter, setAchCategoryFilter] = useState('ALL');
  const [achRarityFilter, setAchRarityFilter] = useState('ALL');
  const [achPage, setAchPage] = useState(1);
  const pageSize = 15;

  // Reward Filter
  const [rewardSearch, setRewardSearch] = useState('');

  // Modals
  const [editingAch, setEditingAch] = useState<Partial<Achievement> | null>(null);
  const [isAchModalOpen, setIsAchModalOpen] = useState(false);
  const [savingAch, setSavingAch] = useState(false);

  const [editingReward, setEditingReward] = useState<Partial<Reward> | null>(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [savingReward, setSavingReward] = useState(false);

  useEffect(() => {
    fetchAllData();

    if (socket) {
      socket.on('reward:redeemed', (newRedemption: RewardRedemption) => {
        setRedemptions(prev => [newRedemption, ...prev]);
        // Update reward stock in UI
        setRewards(prev => prev.map(r => r.id === newRedemption.rewardId ? { ...r, stock: Math.max(0, r.stock - 1) } : r));
      });
      return () => {
        socket.off('reward:redeemed');
      };
    }
  }, [serverUrl, socket]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [achRes, rewRes, redRes] = await Promise.all([
        apiFetch(`${serverUrl}/api/achievements`),
        apiFetch(`${serverUrl}/api/rewards`),
        apiFetch(`${serverUrl}/api/rewards/redemptions`)
      ]);
      if (achRes.ok) setAchievements(await achRes.json());
      if (rewRes.ok) setRewards(await rewRes.json());
      if (redRes.ok) setRedemptions(await redRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ==================== ACHIEVEMENTS HANDLERS ====================
  const handleOpenCreateAch = () => {
    setEditingAch({
      code: 'ACH_' + Date.now().toString().slice(-6),
      name: '',
      description: '',
      icon: '🏆',
      category: 'SPECIAL',
      conditionType: 'AC_COUNT',
      conditionValue: 1,
      points: 20,
      rarity: 'COMMON',
      isActive: true
    });
    setIsAchModalOpen(true);
  };

  const handleOpenEditAch = (ach: Achievement) => {
    setEditingAch({ ...ach });
    setIsAchModalOpen(true);
  };

  const handleSaveAch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAch || !editingAch.name?.trim()) {
      alert('Vui lòng nhập tên thành tựu');
      return;
    }

    try {
      setSavingAch(true);
      const isEdit = !!editingAch.id;
      const url = isEdit ? `${serverUrl}/api/achievements/${editingAch.id}` : `${serverUrl}/api/achievements`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAch)
      });

      if (res.ok) {
        const saved = await res.json();
        if (isEdit) {
          setAchievements(prev => prev.map(a => a.id === saved.id ? saved : a));
        } else {
          setAchievements(prev => [saved, ...prev]);
        }
        setIsAchModalOpen(false);
        setEditingAch(null);
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.error || 'Không thể lưu thành tựu'}`);
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    } finally {
      setSavingAch(false);
    }
  };

  const handleDeleteAch = async (ach: Achievement) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa thành tựu "${ach.name}"?`)) return;
    try {
      const res = await apiFetch(`${serverUrl}/api/achievements/${ach.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAchievements(prev => prev.filter(a => a.id !== ach.id));
      } else {
        alert('Không thể xóa thành tựu');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleAchActive = async (ach: Achievement) => {
    try {
      const res = await apiFetch(`${serverUrl}/api/achievements/${ach.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !ach.isActive })
      });
      if (res.ok) {
        const updated = await res.json();
        setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ==================== REWARDS HANDLERS ====================
  const handleOpenCreateReward = () => {
    setEditingReward({
      name: '',
      description: '',
      icon: '🎁',
      pointsRequired: 50,
      stock: 10,
      isActive: true
    });
    setIsRewardModalOpen(true);
  };

  const handleOpenEditReward = (reward: Reward) => {
    setEditingReward({ ...reward });
    setIsRewardModalOpen(true);
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward || !editingReward.name?.trim()) {
      alert('Vui lòng nhập tên phần thưởng');
      return;
    }

    try {
      setSavingReward(true);
      const isEdit = !!editingReward.id;
      const url = isEdit ? `${serverUrl}/api/rewards/${editingReward.id}` : `${serverUrl}/api/rewards`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingReward)
      });

      if (res.ok) {
        const saved = await res.json();
        if (isEdit) {
          setRewards(prev => prev.map(r => r.id === saved.id ? saved : r));
        } else {
          setRewards(prev => [saved, ...prev]);
        }
        setIsRewardModalOpen(false);
        setEditingReward(null);
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.error || 'Không thể lưu phần thưởng'}`);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingReward(false);
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phần thưởng "${reward.name}"?`)) return;
    try {
      const res = await apiFetch(`${serverUrl}/api/rewards/${reward.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRewards(prev => prev.filter(r => r.id !== reward.id));
      } else {
        alert('Không thể xóa phần thưởng');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateRedemptionStatus = async (redemptionId: string, status: 'APPROVED' | 'CLAIMED' | 'REJECTED') => {
    try {
      const res = await apiFetch(`${serverUrl}/api/rewards/redemptions/${redemptionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setRedemptions(prev => prev.map(r => r.id === updated.id ? updated : r));
        if (status === 'REJECTED') {
          // Refresh rewards stock
          fetchAllData();
        }
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Filtered Achievements
  const filteredAchievements = achievements.filter(a => {
    if (achSearch.trim()) {
      const q = achSearch.toLowerCase().trim();
      const matchName = (a.name || '').toLowerCase().includes(q);
      const matchCode = (a.code || '').toLowerCase().includes(q);
      const matchDesc = (a.description || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    if (achCategoryFilter !== 'ALL' && a.category !== achCategoryFilter) {
      return false;
    }
    if (achRarityFilter !== 'ALL' && a.rarity !== achRarityFilter) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredAchievements.length / pageSize) || 1;
  const currentAchPage = Math.min(achPage, totalPages);
  const pagedAchievements = filteredAchievements.slice((currentAchPage - 1) * pageSize, currentAchPage * pageSize);

  // Filtered Rewards
  const filteredRewards = rewards.filter(r => {
    if (rewardSearch.trim()) {
      const q = rewardSearch.toLowerCase().trim();
      return (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const getRarityBadge = (rarity: AchievementRarity) => {
    switch (rarity) {
      case 'LEGENDARY': return { label: 'Huyền Thoại', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'EPIC': return { label: 'Sử Thi', bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'RARE': return { label: 'Hiếm', bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      default: return { label: 'Phổ Thông', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={28} style={{ color: '#fbbf24' }} />
            <h2 style={{ fontSize: '1.45rem', margin: 0 }}>Quản Lý Thành Tựu & Đổi Quà</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Hệ thống 100+ thành tựu tự động chấm thưởng điểm và cửa hàng đổi quà thực tế cho học sinh
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={fetchAllData}
            disabled={loading}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Làm Mới
          </button>

          {activeTab === 'achievements' && (
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateAch}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Thêm Thành Tựu Mới
            </button>
          )}

          {activeTab === 'rewards' && (
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateReward}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Thêm Phần Thưởng Mới
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'achievements' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('achievements')}
        >
          <Trophy size={16} /> Danh Sách Thành Tựu ({achievements.length})
        </button>
        <button
          className={`btn ${activeTab === 'rewards' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('rewards')}
        >
          <Gift size={16} /> Kho Phần Thưởng ({rewards.length})
        </button>
        <button
          className={`btn ${activeTab === 'redemptions' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setActiveTab('redemptions')}
        >
          <ListOrdered size={16} /> Yêu Cầu Đổi Quà ({redemptions.filter(r => r.status === 'PENDING').length} chờ duyệt)
        </button>
      </div>

      {/* TAB 1: ACHIEVEMENTS LIST */}
      {activeTab === 'achievements' && (
        <div>
          {/* Search & Filter Bar */}
          <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', padding: '14px 18px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="🔍 Tìm kiếm thành tựu theo tên, mã hoặc mô tả..."
                value={achSearch}
                onChange={e => { setAchSearch(e.target.value); setAchPage(1); }}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Chủ đề:</span>
              <select
                className="input-field"
                value={achCategoryFilter}
                onChange={e => { setAchCategoryFilter(e.target.value); setAchPage(1); }}
                style={{ minWidth: '160px' }}
              >
                <option value="ALL">Tất cả chủ đề</option>
                <option value="BEGINNER">Người mới bắt đầu</option>
                <option value="PROBLEM_SOLVING">Giải bài tập</option>
                <option value="CONTEST">Kỳ thi & Olympic</option>
                <option value="STREAK">Chuỗi hoạt động</option>
                <option value="SPEED">Tốc độ & Tối ưu</option>
                <option value="ACCURACY">Độ chính xác</option>
                <option value="DEDICATION">Chăm chỉ</option>
                <option value="SPECIAL">Thành tích đặc biệt</option>
                <option value="MASTERY">Bậc thầy</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Độ hiếm:</span>
              <select
                className="input-field"
                value={achRarityFilter}
                onChange={e => { setAchRarityFilter(e.target.value); setAchPage(1); }}
                style={{ minWidth: '130px' }}
              >
                <option value="ALL">Tất cả</option>
                <option value="COMMON">Phổ Thông</option>
                <option value="RARE">Hiếm</option>
                <option value="EPIC">Sử Thi</option>
                <option value="LEGENDARY">Huyền Thoại</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Hiển thị <strong>{filteredAchievements.length}</strong> / {achievements.length} thành tựu
            </div>
          </div>

          {/* Table */}
          <div className="arena-problem-table-container">
            <table className="desktop-data-table">
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>Icon</th>
                  <th style={{ width: '130px' }}>Mã Code</th>
                  <th>Tên Thành Tựu & Mô Tả</th>
                  <th style={{ width: '130px' }}>Độ Hiếm</th>
                  <th style={{ width: '150px' }}>Điều Kiện Mở Khóa</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Điểm</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedAchievements.map(ach => {
                  const rarity = getRarityBadge(ach.rarity);
                  return (
                    <tr key={ach.id} className="data-table-row">
                      <td style={{ textAlign: 'center', fontSize: '1.4rem' }}>{ach.icon || '🏆'}</td>
                      <td>
                        <span className="code-pill">{ach.code}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {ach.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {ach.description}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: rarity.bg,
                            color: rarity.color,
                            border: `1px solid ${rarity.border}`,
                            fontSize: '0.74rem'
                          }}
                        >
                          {rarity.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {ach.conditionType} : <strong>{ach.conditionValue}</strong>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-amber)', fontSize: '0.88rem' }}>
                        +{ach.points}đ
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`badge ${ach.isActive ? 'badge-primary' : 'badge-outline'}`}
                          style={{ cursor: 'pointer', fontSize: '0.74rem', border: 'none' }}
                          onClick={() => handleToggleAchActive(ach)}
                          title="Bấm để bật/tắt kích hoạt thành tựu"
                        >
                          {ach.isActive ? 'Đang bật' : 'Đã tắt'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenEditAch(ach)}
                            title="Chỉnh sửa"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--verdict-wa)' }}
                            onClick={() => handleDeleteAch(ach)}
                            title="Xóa"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Trang <strong>{currentAchPage}</strong> / {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={currentAchPage === 1}
                  onClick={() => setAchPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Trước
                </button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      className={`btn btn-sm ${currentAchPage === pNum ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setAchPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>...</span>}
                <button
                  className="btn btn-outline btn-sm"
                  disabled={currentAchPage === totalPages}
                  onClick={() => setAchPage(p => Math.min(totalPages, p + 1))}
                >
                  Sau <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REWARDS INVENTORY */}
      {activeTab === 'rewards' && (
        <div>
          <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '14px 18px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="🔍 Tìm kiếm phần thưởng trong kho..."
                value={rewardSearch}
                onChange={e => setRewardSearch(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%' }}
              />
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Tổng cộng <strong>{rewards.length}</strong> vật phẩm phần thưởng
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredRewards.map(reward => (
              <div
                key={reward.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '20px',
                  opacity: reward.isActive ? 1 : 0.6
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '2.4rem' }}>{reward.icon || '🎁'}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className={`badge ${reward.stock > 0 ? 'badge-primary' : 'badge-outline'}`} style={{ fontSize: '0.72rem' }}>
                        Kho: {reward.stock} cái
                      </span>
                      <span className={`badge ${reward.isActive ? 'badge-secondary' : 'badge-outline'}`} style={{ fontSize: '0.72rem' }}>
                        {reward.isActive ? 'Đang mở' : 'Đã khóa'}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                    {reward.name}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', minHeight: '36px' }}>
                    {reward.description || 'Phần thưởng vinh danh dành cho học sinh chăm chỉ đạt điểm cao'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-amber)', marginBottom: '16px' }}>
                    <span>⭐ {reward.pointsRequired} điểm</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onClick={() => handleOpenEditReward(reward)}
                  >
                    <Edit3 size={13} /> Sửa
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--verdict-wa)' }}
                    onClick={() => handleDeleteReward(reward)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REDEMPTIONS REQUESTS */}
      {activeTab === 'redemptions' && (
        <div className="arena-problem-table-container">
          <table className="desktop-data-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Icon</th>
                <th>Phần Thưởng</th>
                <th>Học Sinh Đổi</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Điểm Tiêu</th>
                <th style={{ width: '160px' }}>Thời Gian Yêu Cầu</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Trạng Thái</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Duyệt Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Chưa có học sinh nào yêu cầu đổi quà
                  </td>
                </tr>
              ) : (
                redemptions.map(r => {
                  const statusBadge = r.status === 'CLAIMED'
                    ? { label: 'Đã nhận quà', color: 'var(--accent-emerald)' }
                    : r.status === 'APPROVED'
                    ? { label: 'Đã duyệt', color: 'var(--accent-cyan)' }
                    : r.status === 'REJECTED'
                    ? { label: 'Đã từ chối', color: 'var(--verdict-wa)' }
                    : { label: 'Chờ duyệt', color: 'var(--accent-amber)' };

                  return (
                    <tr key={r.id} className="data-table-row">
                      <td style={{ textAlign: 'center', fontSize: '1.4rem' }}>{r.rewardIcon || '🎁'}</td>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>{r.rewardName}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.studentName}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-amber)' }}>
                        {r.pointsSpent}đ
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(r.requestedAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: statusBadge.color, fontWeight: 700, fontSize: '0.78rem' }}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'PENDING' && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: 'var(--accent-emerald)', border: 'none', padding: '3px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleUpdateRedemptionStatus(r.id, 'APPROVED')}
                            >
                              <Check size={12} /> Duyệt
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--verdict-wa)', padding: '3px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleUpdateRedemptionStatus(r.id, 'REJECTED')}
                            >
                              <X size={12} /> Từ chối
                            </button>
                          </div>
                        )}
                        {r.status === 'APPROVED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                            onClick={() => handleUpdateRedemptionStatus(r.id, 'CLAIMED')}
                          >
                            <Gift size={12} /> Đã trao quà
                          </button>
                        )}
                        {r.status === 'CLAIMED' && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Hoàn tất</span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span style={{ color: 'var(--verdict-wa)', fontSize: '0.74rem' }}>Đã hoàn điểm</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ACHIEVEMENT */}
      {isAchModalOpen && editingAch && (
        <div className="modal-backdrop" onClick={() => setIsAchModalOpen(false)}>
          <div className="glass-card modal-content" style={{ maxWidth: '580px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} color="#fbbf24" /> {editingAch.id ? 'Sửa Thành Tựu' : 'Tạo Thành Tựu Mới'}
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setIsAchModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveAch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Biểu tượng:</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ textAlign: 'center', fontSize: '1.2rem' }}
                    value={editingAch.icon || '🏆'}
                    onChange={e => setEditingAch({ ...editingAch, icon: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên thành tựu:</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={editingAch.name || ''}
                    onChange={e => setEditingAch({ ...editingAch, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mã Code nhận diện:</label>
                <input
                  type="text"
                  className="input-field"
                  value={editingAch.code || ''}
                  onChange={e => setEditingAch({ ...editingAch, code: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả chi tiết:</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={editingAch.description || ''}
                  onChange={e => setEditingAch({ ...editingAch, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chủ đề:</label>
                  <select
                    className="input-field"
                    value={editingAch.category || 'SPECIAL'}
                    onChange={e => setEditingAch({ ...editingAch, category: e.target.value as any })}
                  >
                    <option value="BEGINNER">Người mới bắt đầu</option>
                    <option value="PROBLEM_SOLVING">Giải bài tập</option>
                    <option value="CONTEST">Kỳ thi & Olympic</option>
                    <option value="STREAK">Chuỗi hoạt động</option>
                    <option value="SPEED">Tốc độ & Tối ưu</option>
                    <option value="ACCURACY">Độ chính xác</option>
                    <option value="DEDICATION">Chăm chỉ</option>
                    <option value="SPECIAL">Thành tích đặc biệt</option>
                    <option value="MASTERY">Bậc thầy</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Độ hiếm:</label>
                  <select
                    className="input-field"
                    value={editingAch.rarity || 'COMMON'}
                    onChange={e => setEditingAch({ ...editingAch, rarity: e.target.value as any })}
                  >
                    <option value="COMMON">Phổ Thông (Xám)</option>
                    <option value="RARE">Hiếm (Xanh Dương)</option>
                    <option value="EPIC">Sử Thi (Tím)</option>
                    <option value="LEGENDARY">Huyền Thoại (Đỏ Cam)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Loại điều kiện:</label>
                  <select
                    className="input-field"
                    value={editingAch.conditionType || 'AC_COUNT'}
                    onChange={e => setEditingAch({ ...editingAch, conditionType: e.target.value as any })}
                  >
                    <option value="FIRST_SUBMISSION">Nộp bài lần đầu</option>
                    <option value="FIRST_AC">Đạt AC bài đầu tiên</option>
                    <option value="AC_COUNT">Số lần đạt AC</option>
                    <option value="SUBMISSION_COUNT">Tổng số bài nộp</option>
                    <option value="SOLVE_COUNT">Số bài tập khác nhau</option>
                    <option value="CONTEST_COUNT">Số kỳ thi tham gia</option>
                    <option value="POINTS">Tích lũy điểm thưởng</option>
                    <option value="MANUAL">Chấm tay / Giáo viên duyệt</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mục tiêu:</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    value={editingAch.conditionValue || 1}
                    onChange={e => setEditingAch({ ...editingAch, conditionValue: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Điểm thưởng:</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={editingAch.points || 10}
                    onChange={e => setEditingAch({ ...editingAch, points: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAchModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAch}>
                  {savingAch ? 'Đang lưu...' : 'Lưu Thành Tựu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT REWARD */}
      {isRewardModalOpen && editingReward && (
        <div className="modal-backdrop" onClick={() => setIsRewardModalOpen(false)}>
          <div className="glass-card modal-content" style={{ maxWidth: '500px', width: '100%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gift size={20} color="var(--accent-cyan)" /> {editingReward.id ? 'Sửa Phần Thưởng' : 'Thêm Phần Thưởng Mới'}
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setIsRewardModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveReward} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Icon:</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ textAlign: 'center', fontSize: '1.2rem' }}
                    value={editingReward.icon || '🎁'}
                    onChange={e => setEditingReward({ ...editingReward, icon: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên phần thưởng:</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="Ví dụ: Ly nước ngọt, Bịch bánh snack..."
                    value={editingReward.name || ''}
                    onChange={e => setEditingReward({ ...editingReward, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả phần thưởng:</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Mô tả quà tặng hoặc quy cách nhận..."
                  value={editingReward.description || ''}
                  onChange={e => setEditingReward({ ...editingReward, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Số điểm cần đổi (⭐):</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    required
                    value={editingReward.pointsRequired || 50}
                    onChange={e => setEditingReward({ ...editingReward, pointsRequired: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Số lượng trong kho (stock):</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    required
                    value={editingReward.stock !== undefined ? editingReward.stock : 10}
                    onChange={e => setEditingReward({ ...editingReward, stock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsRewardModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingReward}>
                  {savingReward ? 'Đang lưu...' : 'Lưu Phần Thưởng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
