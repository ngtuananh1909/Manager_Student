import React, { useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  Server, 
  Laptop, 
  Check, 
  ArrowRight, 
  School,
  Info,
  Shield,
  Zap
} from 'lucide-react';

interface Props {
  onSelectRole: (role: 'host' | 'student') => void;
}

export const DeviceRoleSetup: React.FC<Props> = ({ onSelectRole }) => {
  const { scanForServers } = useNetwork();
  const [selectedRole, setSelectedRole] = useState<'host' | 'student' | null>(null);

  const handleConfirm = (role: 'host' | 'student') => {
    setSelectedRole(role);
    localStorage.setItem('schooljudge_device_role', role);
    
    if ((window as any).electronAPI?.setAppRole) {
      (window as any).electronAPI.setAppRole(role);
    }

    if (role === 'student') {
      scanForServers();
    }

    setTimeout(() => {
      onSelectRole(role);
    }, 280);
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '36px 24px', 
      overflowY: 'auto',
      position: 'relative'
    }}>
      {/* Ambient Radial Spotlight */}
      <div style={{
        position: 'absolute',
        width: '650px',
        height: '650px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(6, 182, 212, 0.04) 50%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{ width: '100%', maxWidth: '840px', position: 'relative', zIndex: 1 }} className="animate-scale-in">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: '18px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 24px var(--primary-glow)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <School size={32} color="#fff" />
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '10px', color: 'var(--text-main)' }}>
            Thiết Lập Vai Trò Máy Tính
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '540px', margin: '0 auto', lineHeight: 1.55 }}>
            Ứng dụng vận hành độc lập trong mạng nội bộ (LAN). Vui lòng xác định cấu hình cho thiết bị này trong phòng máy:
          </p>
        </div>

        {/* 2 Role Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', marginBottom: '28px' }}>
          
          {/* Option 1: Teacher Server */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '30px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: selectedRole === 'host' ? '2px solid var(--primary-light)' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedRole === 'host' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
              boxShadow: selectedRole === 'host' ? '0 0 25px rgba(99, 102, 241, 0.35)' : undefined,
              borderRadius: 'var(--radius-lg)',
              transition: 'all var(--dur-normal) var(--ease-spring)'
            }}
            onClick={() => handleConfirm('host')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'rgba(99, 102, 241, 0.15)', 
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--primary-light)'
                }}>
                  <Server size={24} />
                </div>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                  Máy Chủ Điều Hành
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>
                Máy Chủ Giáo Viên
              </h2>

              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.55 }}>
                Dành cho máy của Giáo viên hoặc Giám thị. Đóng vai trò máy chủ lưu trữ đề thi, cơ sở dữ liệu và máy chấm C++ tự động.
              </p>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Tự động kích hoạt bộ chấm bài C++ (g++ Sandbox)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Quản lý kho đề thi, trích xuất đề Word/PDF tự động</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Phát tín hiệu khám phá UDP mạng LAN cho học sinh</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Bảng xếp hạng trực tiếp, giám sát phòng thi chống gian lận</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={(e) => { e.stopPropagation(); handleConfirm('host'); }}
            >
              Chọn Làm Máy Chủ Giáo Viên <ArrowRight size={16} />
            </button>
          </div>

          {/* Option 2: Student Client */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '30px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: selectedRole === 'student' ? '2px solid var(--accent-emerald)' : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedRole === 'student' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface)',
              boxShadow: selectedRole === 'student' ? '0 0 25px rgba(16, 185, 129, 0.35)' : undefined,
              borderRadius: 'var(--radius-lg)',
              transition: 'all var(--dur-normal) var(--ease-spring)'
            }}
            onClick={() => handleConfirm('student')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)'
                }}>
                  <Laptop size={24} />
                </div>
                <span className="badge badge-ac">
                  Máy Trạm Học Sinh
                </span>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-main)' }}>
                Máy Trạm Thí Sinh
              </h2>

              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.55 }}>
                Dành cho tất cả máy tính con của Học sinh trong phòng máy. Nhẹ, nhanh, không cần cài đặt thêm bất kỳ phần mềm lập trình nào.
              </p>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span><strong>Không yêu cầu cài đặt MinGW hay Code::Blocks</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Tự động dò tìm máy chủ giáo viên qua mạng LAN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Đọc đề thi Word/PDF và viết mã trong Monaco Editor</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span>Nộp bài và nhận phản hồi chấm điểm thời gian thực</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-success"
              style={{ 
                width: '100%', 
                padding: '12px', 
                fontWeight: 600, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px' 
              }}
              onClick={(e) => { e.stopPropagation(); handleConfirm('student'); }}
            >
              Chọn Làm Máy Trạm Học Sinh <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '8px', 
          fontSize: '0.82rem', 
          color: 'var(--text-muted)' 
        }}>
          <Info size={15} style={{ color: 'var(--primary-light)' }} />
          <span>Bạn có thể chuyển đổi lại cấu hình vai trò bất kỳ lúc nào trong cài đặt kết nối mạng.</span>
        </div>
      </div>
    </div>
  );
};
export default DeviceRoleSetup;
