import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { LANDiscoveryModal } from './LANDiscoveryModal';
import { 
  Code2, 
  Wifi, 
  Globe, 
  Flame, 
  Trophy, 
  LogOut, 
  Sparkles, 
  ShieldAlert, 
  Settings, 
  BarChart3, 
  School, 
  Activity,
  Layers,
  Users,
  Gift
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const { user, role, logout } = useAuth();
  const { networkMode, isConnected, latency, serverUrl } = useNetwork();
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  return (
    <>
      <header className="app-header">
        {/* Left: Brand & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => setActiveTab(role === 'host' ? 'contests-manage' : 'contests')}
          >
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px var(--primary-glow)',
              transition: 'transform var(--dur-normal) var(--ease-spring), box-shadow var(--dur-normal) ease'
            }}>
              <Code2 size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  ChauCaoJudge
                </span>
                <span style={{ 
                  fontSize: '0.68rem', 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 700,
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}>
                  C++11
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                {role === 'host' ? 'Máy Chủ Quản Trị & Chấm Bài' : 'Mini Online Judge Học Sinh'}
              </div>
            </div>
          </div>

          {/* Network Mode Switch Pill */}
          <button 
            className="btn btn-secondary btn-sm"
            style={{ 
              background: 'var(--bg-surface)', 
              borderColor: isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
              fontSize: '0.78rem',
              padding: '4px 10px',
              transition: 'all var(--dur-normal) var(--ease-spring)'
            }}
            onClick={() => setShowNetworkModal(true)}
            title="Bấm để chuyển đổi Mạng LAN hoặc Internet DDNS"
          >
            {networkMode === 'lan' ? (
              <Wifi size={13} style={{ color: 'var(--accent-emerald)' }} className={isConnected ? "animate-pulse-subtle" : ""} />
            ) : (
              <Globe size={13} style={{ color: 'var(--accent-cyan)' }} className={isConnected ? "animate-pulse-subtle" : ""} />
            )}
            <span style={{ color: 'var(--text-secondary)' }}>
              {networkMode === 'lan' ? 'LAN:' : 'Internet:'}
            </span>
            <span style={{ color: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {isConnected ? (latency !== null ? `${latency}ms` : 'Online') : 'Offline'}
            </span>
          </button>
        </div>

        {/* Center: Modern Segmented Tab Bar */}
        <nav className="nav-segmented-tabs">
          {role === 'user' ? (
            <>
              <button 
                className={`nav-tab-btn ${activeTab === 'contests' ? 'active' : ''}`}
                onClick={() => setActiveTab('contests')}
              >
                <Trophy size={14} /> Kỳ Thi & Kiểm Tra
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('leaderboard')}
              >
                <BarChart3 size={14} /> Bảng Xếp Hạng
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
                onClick={() => setActiveTab('submissions')}
              >
                <Layers size={14} /> Lịch Sử Nộp
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'badges' ? 'active' : ''}`}
                onClick={() => setActiveTab('badges')}
              >
                <Gift size={14} /> Thành Tựu & Quà
              </button>
            </>
          ) : (
            <>
              <button 
                className={`nav-tab-btn ${activeTab === 'contests-manage' ? 'active' : ''}`}
                onClick={() => setActiveTab('contests-manage')}
              >
                <Trophy size={14} /> Kỳ Thi Nội Bộ
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <Users size={14} /> Học Sinh
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'problems-manage' ? 'active' : ''}`}
                onClick={() => setActiveTab('problems-manage')}
              >
                <Layers size={14} /> Đề & Test
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'live-monitor' ? 'active' : ''}`}
                onClick={() => setActiveTab('live-monitor')}
              >
                <Activity size={14} /> Giám Sát
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('leaderboard')}
              >
                <Trophy size={14} /> Bảng Điểm
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'anti-cheat' ? 'active' : ''}`}
                onClick={() => setActiveTab('anti-cheat')}
              >
                <ShieldAlert size={14} /> Gian Lận
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
                onClick={() => setActiveTab('classes')}
              >
                <School size={14} /> Lớp Học
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'statistics' ? 'active' : ''}`}
                onClick={() => setActiveTab('statistics')}
              >
                <BarChart3 size={14} /> Thống Kê
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'achievements-manage' ? 'active' : ''}`}
                onClick={() => setActiveTab('achievements-manage')}
              >
                <Gift size={14} /> Thành Tựu & Quà
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={14} /> Máy Chấm
              </button>
            </>
          )}
        </nav>

        {/* Right: Authenticated User Profile & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {role === 'user' && user && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.8rem',
              fontWeight: 700
            }} title="Chuỗi streak ngày làm bài">
              <Flame size={14} fill="#f59e0b" color="#f59e0b" />
              <span>{user.streak || 1} ngày</span>
            </div>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                padding: '4px 10px', 
                borderRadius: 'var(--radius-md)', 
                background: role === 'host' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${role === 'host' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ 
                  fontSize: '0.78rem', 
                  fontWeight: 700, 
                  color: role === 'host' ? 'var(--primary-light)' : 'var(--accent-emerald)' 
                }}>
                  {role === 'host' ? '👨‍🏫 GIÁO VIÊN' : '🎓 HỌC SINH'}: {user.fullName || user.username}
                </span>
              </div>

              <button 
                className="btn btn-outline btn-sm"
                onClick={logout}
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut size={14} /> Đăng Xuất
              </button>
            </div>
          )}
        </div>
      </header>

      <LANDiscoveryModal isOpen={showNetworkModal} onClose={() => setShowNetworkModal(false)} />
    </>
  );
};
