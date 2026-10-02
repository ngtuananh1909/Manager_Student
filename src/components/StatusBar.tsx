import React, { useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import { LANDiscoveryModal } from './LANDiscoveryModal';
import { 
  Wifi, 
  Globe, 
  Terminal, 
  Shield, 
  Cpu, 
  SlidersHorizontal,
  Circle
} from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { networkMode, isConnected, latency, serverUrl } = useNetwork();
  const { role, user } = useAuth();
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  // Extract clean hostname for display
  const displayHost = serverUrl 
    ? serverUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '') 
    : 'Chưa cấu hình';

  return (
    <>
      <footer className="desktop-status-bar">
        {/* Left Section: Remote & Server Telemetry */}
        <div className="status-bar-group">
          {/* Remote Network Target (VSCode style remote badge) */}
          <button 
            type="button"
            className={`status-bar-item status-bar-interactive remote-target-btn ${isConnected ? 'online' : 'offline'}`}
            onClick={() => setShowNetworkModal(true)}
            title="Nhấp để cấu hình IP máy chủ hoặc chuyển chế độ mạng (F2)"
          >
            {networkMode === 'lan' ? <Wifi size={12} /> : <Globe size={12} />}
            <span className="status-dot" />
            <span className="status-text">
              {networkMode.toUpperCase()}: {displayHost}
            </span>
            {isConnected && latency !== null && (
              <span className="status-latency">
                {latency}ms
              </span>
            )}
          </button>

          {/* Compiler Runtime Status */}
          <div className="status-bar-item compiler-status" title="Bộ biên dịch C++ chuẩn trên máy chủ">
            <Cpu size={12} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>g++ -O2 (C++11)</span>
          </div>
        </div>

        {/* Right Section: System & Context */}
        <div className="status-bar-group">
          {/* Role Status */}
          <div className="status-bar-item role-status">
            <Shield size={12} style={{ color: role === 'host' ? 'var(--primary-light)' : 'var(--accent-emerald)' }} />
            <span>{role === 'host' ? 'Host / Giám Thị' : 'Thí Sinh'}</span>
          </div>

          {/* Current User */}
          {user && (
            <div className="status-bar-item user-status">
              <span className="user-name-tag">{user.fullName || user.username}</span>
            </div>
          )}

          {/* App Version */}
          <div className="status-bar-item version-status">
            <span>v1.2.1</span>
          </div>
        </div>
      </footer>

      {/* Embedded Network Modal */}
      <LANDiscoveryModal isOpen={showNetworkModal} onClose={() => setShowNetworkModal(false)} />
    </>
  );
};
export default StatusBar;
