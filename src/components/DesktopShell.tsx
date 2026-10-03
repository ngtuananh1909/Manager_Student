import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatusBar } from './StatusBar';
import { 
  Code2, 
  Trophy, 
  BarChart3, 
  Layers, 
  Sparkles, 
  Users, 
  Activity, 
  ShieldAlert, 
  School, 
  Settings, 
  LogOut,
  LineChart,
  User as UserIcon,
  ChevronRight,
  Compass,
  FlaskConical,
  Swords
} from 'lucide-react';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

export const DesktopShell: React.FC<Props> = ({ activeTab, setActiveTab, children }) => {
  const { role, user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Student Navigation Tabs
  const studentNav: NavItem[] = [
    { id: 'contests', label: 'Kỳ Thi & Kiểm Tra', icon: <Trophy size={18} />, shortcut: '1' },
    { id: 'roadmap', label: 'Lộ Trình Thuật Toán', icon: <Compass size={18} />, shortcut: '2' },
    { id: 'arena', label: 'Đấu Trường 1v1', icon: <Swords size={18} />, shortcut: '3' },
    { id: 'sandbox', label: 'Tự Luyện & Test Ground', icon: <FlaskConical size={18} />, shortcut: '4' },
    { id: 'leaderboard', label: 'Bảng Xếp Hạng', icon: <BarChart3 size={18} />, shortcut: '5' },
    { id: 'submissions', label: 'Lịch Sử Nộp Bài', icon: <Layers size={18} />, shortcut: '6' },
    { id: 'badges', label: 'Huy Hiệu & Thành Tích', icon: <Sparkles size={18} />, shortcut: '7' },
  ];

  // Teacher Navigation Tabs
  const teacherNav: NavItem[] = [
    { id: 'contests-manage', label: 'Kỳ Thi & Ca Thi', icon: <Trophy size={18} />, shortcut: '1' },
    { id: 'students', label: 'Quản Lý Học Sinh', icon: <Users size={18} />, shortcut: '2' },
    { id: 'problems-manage', label: 'Ngân Hàng Đề & Test', icon: <Layers size={18} />, shortcut: '3' },
    { id: 'roadmap-manage', label: 'Lộ Trình Học Tập', icon: <Compass size={18} />, shortcut: '4' },
    { id: 'live-monitor', label: 'Giám Sát Phòng Thi Live', icon: <Activity size={18} />, shortcut: '5' },
    { id: 'leaderboard', label: 'Bảng Điểm Kỳ Thi', icon: <BarChart3 size={18} />, shortcut: '6' },
    { id: 'anti-cheat', label: 'Cảnh Báo Gian Lận', icon: <ShieldAlert size={18} />, shortcut: '7' },
    { id: 'classes', label: 'Quản Lý Lớp Học', icon: <School size={18} />, shortcut: '8' },
    { id: 'statistics', label: 'Báo Cáo Thống Kê', icon: <LineChart size={18} />, shortcut: '9' },
    { id: 'settings', label: 'Cấu Hình Máy Chấm (Sandbox)', icon: <Settings size={18} />, shortcut: '0' },
  ];

  const currentNavItems = role === 'host' ? teacherNav : studentNav;

  // Determine active title
  const activeItem = currentNavItems.find(item => item.id === activeTab);
  const activeTitle = activeItem ? activeItem.label : (activeTab === 'problem-detail' ? 'Môi Trường Làm Bài Thi' : 'Không gian làm việc');

  return (
    <div className="desktop-layout-root">
      {/* LEFT 48px ACTIVITY RAIL */}
      <aside className="activity-rail" aria-label="Activity Rail">
        {/* Top App Glyph */}
        <div 
          className="rail-brand" 
          title="ChauCaoJudge LAN — C++ Online Judge"
          onClick={() => setActiveTab(role === 'host' ? 'contests-manage' : 'contests')}
        >
          <div className="rail-brand-icon">
            <Code2 size={20} color="#fff" />
          </div>
        </div>

        {/* Primary Navigation Icons */}
        <nav className="rail-nav-group">
          {currentNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`rail-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                title={`${item.label} (Alt+${item.shortcut})`}
              >
                {item.icon}
                {isActive && <div className="rail-active-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile & Logout */}
        <div className="rail-bottom-group">
          <div className="rail-user-container">
            <button
              type="button"
              className="rail-nav-btn rail-user-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user ? `${user.fullName || user.username} (${role === 'host' ? 'Giáo Viên' : 'Học Sinh'})` : 'Tài khoản'}
            >
              <div className="user-avatar-dot">
                {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
              </div>
            </button>

            {/* Quick User Dropdown */}
            {showUserMenu && (
              <div className="rail-user-menu glass-panel animate-scale-in">
                <div className="rail-user-header">
                  <div className="rail-user-fullname">{user?.fullName || user?.username}</div>
                  <div className="rail-user-role-label">
                    {role === 'host' ? 'Máy Chủ Giáo Viên' : 'Học Sinh / Thí Sinh'}
                  </div>
                </div>
                <div className="rail-menu-divider" />
                <button
                  type="button"
                  className="rail-menu-action logout-action"
                  onClick={() => { setShowUserMenu(false); logout(); }}
                >
                  <LogOut size={14} />
                  <span>Đăng Xuất Tài Khoản</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT CONTAINER */}
      <div className="desktop-main-wrapper">
        {/* Sub-header / Window Top Context Bar */}
        <header className="desktop-view-header">
          <div className="view-header-title-group">
            <span className="view-header-crumb">ChauCaoJudge</span>
            <ChevronRight size={14} className="crumb-separator" />
            <h1 className="view-header-title">{activeTitle}</h1>
          </div>

          <div className="view-header-actions">
            {/* Keyboard shortcut hint */}
            <div className="shortcut-pill">
              <kbd>Ctrl</kbd> + <kbd>K</kbd> Tìm nhanh
            </div>
          </div>
        </header>

        {/* Dynamic Workspace */}
        <main className="desktop-workspace">
          {children}
        </main>

        {/* Bottom Persistent Status Bar */}
        <StatusBar />
      </div>
    </div>
  );
};
export default DesktopShell;
