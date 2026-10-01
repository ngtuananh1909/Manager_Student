import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { ShieldCheck, Server, User, Key, School, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

export const FirstRunSetup: React.FC = () => {
  const { setupFirstAdmin } = useAuth();
  const { serverUrl } = useNetwork();

  const [serverName, setServerName] = useState('Phòng Máy Chấm C++ Nội Bộ - THPT Chuyên');
  const [fullName, setFullName] = useState('Thầy Nguyễn Văn Nam');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [className, setClassName] = useState('10 Tin Học');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Vui lòng điền tên đăng nhập và mật khẩu quản trị');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Mật khẩu cần tối thiểu 6 ký tự để đảm bảo an toàn');
      return;
    }

    setIsSubmitting(true);
    const res = await setupFirstAdmin({
      username,
      password,
      fullName,
      serverName,
      className
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Khởi tạo thất bại');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '36px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px var(--primary-glow)',
            marginBottom: '14px'
          }}>
            <ShieldCheck size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '6px' }}>
            Khởi Tạo Hệ Thống Lần Đầu (First-Run Setup)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto' }}>
            Cơ sở dữ liệu đang trống hoàn toàn. Hãy tạo tài khoản Quản trị viên / Giáo viên đầu tiên để quản lý bài tập và phòng máy.
          </p>
        </div>

        {errorMsg && (
          <div style={{ 
            background: 'rgba(244, 63, 94, 0.1)', 
            border: '1px solid rgba(244, 63, 94, 0.3)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-rose)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              TÊN PHÒNG MÁY CHỦ
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ví dụ: Phòng Máy Chấm C++ - THPT Chuyên"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                HỌ VÀ TÊN GIÁO VIÊN
              </label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Thầy Nguyễn Văn Nam"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                TÊN LỚP HỌC KHỞI TẠO
              </label>
              <input
                type="text"
                className="input-field"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="10 Tin Học"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                TÊN ĐĂNG NHẬP ADMIN
              </label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                MẬT KHẨU QUẢN TRỊ
              </label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              XÁC NHẬN MẬT KHẨU QUẢN TRỊ
            </label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px', padding: '12px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang khởi tạo hệ thống...' : 'Hoàn Tất Khởi Tạo & Vào Giao Diện Quản Trị'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Máy chủ đang kết nối tại: <code>{serverUrl}</code>
        </div>
      </div>
    </div>
  );
};
