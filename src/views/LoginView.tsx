import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { Code2, User, Key, Globe, Wifi, Shield, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { LANDiscoveryModal } from '../components/LANDiscoveryModal';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { networkMode, serverUrl, isConnected, latency } = useNetwork();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await login(username, password, fullName);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Đăng nhập không thành công');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '36px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '52px', 
            height: '52px', 
            borderRadius: '14px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 6px 20px var(--primary-glow)'
          }}>
            <Code2 size={30} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>
            Đăng Nhập SchoolJudge
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Ứng dụng tự động nhận diện vai trò (Giáo viên / Học sinh) theo tài khoản của bạn
          </p>
        </div>

        {/* Network Mode Status Pill */}
        <div 
          onClick={() => setShowNetworkModal(true)}
          style={{ 
            background: 'var(--bg-surface-elevated)', 
            border: '1px solid var(--border-subtle)', 
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
          title="Nhấp để cấu hình chế độ kết nối mạng LAN hoặc Internet DDNS"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {networkMode === 'lan' ? (
              <Wifi size={14} style={{ color: 'var(--accent-emerald)' }} />
            ) : (
              <Globe size={14} style={{ color: 'var(--accent-cyan)' }} />
            )}
            <span style={{ fontWeight: 600 }}>
              Chế độ: {networkMode === 'lan' ? 'Mạng LAN (Tại trường)' : 'Internet (Tại nhà)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              width: '7px', 
              height: '7px', 
              borderRadius: '50%', 
              background: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
            }} />
            <span style={{ color: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {isConnected ? (latency !== null ? `${latency}ms` : 'Online') : 'Offline'}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'rgba(244, 63, 94, 0.1)', 
            border: '1px solid rgba(244, 63, 94, 0.3)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-rose)',
            fontSize: '0.82rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              TÊN ĐĂNG NHẬP / MÃ HỌC SINH
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="VD: admin hoặc nguyenvana"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              MẬT KHẨU
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '6px', padding: '11px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> Đang kiểm tra...
              </>
            ) : (
              <>
                Đăng Nhập Vào Hệ Thống <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button 
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.78rem', width: '100%' }}
            onClick={() => setShowNetworkModal(true)}
          >
            ⚙️ Cấu Hình Địa Chỉ Kết Nối Mạng (LAN / Internet)
          </button>
        </div>
      </div>

      <LANDiscoveryModal isOpen={showNetworkModal} onClose={() => setShowNetworkModal(false)} />
    </div>
  );
};
