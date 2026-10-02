import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { 
  Code2, 
  User, 
  Key, 
  Globe, 
  Wifi, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw,
  SlidersHorizontal,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { LANDiscoveryModal } from '../components/LANDiscoveryModal';

export const LoginView: React.FC = () => {
  const { login, register } = useAuth();
  const { networkMode, serverUrl, isConnected, latency } = useNetwork();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const res = mode === 'register'
      ? await register({ username, password, fullName, joinCode })
      : await login(username, password);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Đăng nhập không thành công');
    }
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '24px', 
      overflowY: 'auto',
      position: 'relative'
    }}>
      {/* Ambient Radial Spotlight */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, rgba(6, 182, 212, 0.05) 50%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Login Card */}
      <div 
        className="glass-panel animate-scale-in" 
        style={{ 
          width: '100%', 
          maxWidth: '430px', 
          padding: '38px 34px',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: '0 8px 24px var(--primary-glow)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <Code2 size={30} color="#fff" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              {mode === 'login' ? 'Đăng nhập SchoolJudge' : 'Đăng ký học sinh'}
            </h2>
            <span style={{ 
              fontSize: '0.68rem', 
              padding: '2px 7px', 
              borderRadius: '5px', 
              fontWeight: 700,
              background: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              fontFamily: 'var(--font-mono)'
            }}>
              C++11
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.45 }}>
            {mode === 'login' ? 'Ứng dụng tự động nhận diện vai trò (Giáo viên / Học sinh) theo tài khoản của bạn' : 'Hệ thống thi đấu và chấm bài lập trình nội bộ trường học'}
          </p>
        </div>

        {/* Network Mode Status Pill */}
        <div 
          onClick={() => setShowNetworkModal(true)}
          className="glass-card"
          style={{ 
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderColor: isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'
          }}
          title="Bấm để cấu hình chế độ kết nối mạng LAN hoặc Internet"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {networkMode === 'lan' ? (
              <Wifi size={14} style={{ color: 'var(--accent-emerald)' }} className={isConnected ? "animate-pulse-subtle" : ""} />
            ) : (
              <Globe size={14} style={{ color: 'var(--accent-cyan)' }} className={isConnected ? "animate-pulse-subtle" : ""} />
            )}
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {networkMode === 'lan' ? 'Mạng LAN phòng máy' : 'Internet từ xa'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              width: '7px', 
              height: '7px', 
              borderRadius: '50%', 
              background: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              boxShadow: isConnected ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none'
            }} />
            <span style={{ color: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {isConnected ? (latency !== null ? `${latency}ms` : 'Online') : 'Offline'}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div 
            className="animate-slide-down"
            style={{ 
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
            }}
          >
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                HỌ VÀ TÊN
              </label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              Tên Đăng Nhập / Mã Thí Sinh
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="input-field"
                placeholder="VD: admin hoặc nguyenvana"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '38px' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
              Mật Khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="password"
                className="input-field"
                placeholder="Nhập mật khẩu của bạn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '38px' }}
                minLength={10}
                maxLength={128}
                required
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                MÃ THAM GIA LỚP
              </label>
              <input
                type="text"
                className="input-field"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={20}
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '6px', padding: '12px', fontSize: '0.92rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> Đang xác thực...
              </>
            ) : (
              <>
                {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '22px', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', width: '100%', marginBottom: '8px' }}
            onClick={() => {
              setMode(current => current === 'login' ? 'register' : 'login');
              setErrorMsg('');
            }}
          >
            {mode === 'login' ? 'Đăng ký bằng mã tham gia lớp' : 'Đã có tài khoản? Đăng nhập'}
          </button>
          <button 
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.78rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
            onClick={() => setShowNetworkModal(true)}
          >
            <SlidersHorizontal size={13} />
            Cấu Hình Kết Nối Mạng (LAN / Internet)
          </button>
        </div>
      </div>

      <LANDiscoveryModal isOpen={showNetworkModal} onClose={() => setShowNetworkModal(false)} />
    </div>
  );
};
export default LoginView;
