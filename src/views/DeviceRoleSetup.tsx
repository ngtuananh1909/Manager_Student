import React, { useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { 
  Server, 
  Monitor, 
  Wifi, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Cpu, 
  Sparkles,
  School
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
    }, 300);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '820px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '16px', 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: '0 8px 24px var(--primary-glow)'
          }}>
            <School size={32} color="#fff" />
          </div>

          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '8px' }}>
            Thiết Lập Vai Trò Cho Máy Tính Này
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.5 }}>
            Ứng dụng chạy hoàn toàn trong mạng nội bộ (LAN). Vui lòng chọn vai trò của máy tính này trong phòng máy:
          </p>
        </div>

        {/* 2 Role Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '22px', marginBottom: '24px' }}>
          
          {/* Option 1: Teacher Server */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '28px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: selectedRole === 'host' ? '2px solid var(--primary-light)' : '1px solid var(--border-medium)',
              background: selectedRole === 'host' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface-elevated)',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleConfirm('host')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ 
                  width: '46px', 
                  height: '46px', 
                  borderRadius: '12px', 
                  background: 'rgba(99, 102, 241, 0.2)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--primary-light)'
                }}>
                  <Server size={24} />
                </div>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)' }}>
                  Máy Chủ
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
                👨‍🏫 Máy Chủ Giáo Viên
              </h3>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                Dành cho máy của Giáo viên / Giám thị. Máy tính này sẽ là trung tâm điều hành và chấm điểm cho cả lớp.
              </p>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Tự động khởi động máy chấm C++ (g++)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Quản lý kho bài tập, đề PDF và tạo kỳ thi</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Phát tín hiệu mạng LAN tự động cho cả phòng máy</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Xem bảng xếp hạng, giám sát realtime và chấm bài</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={(e) => { e.stopPropagation(); handleConfirm('host'); }}
            >
              Chọn Máy Này Làm Máy Chủ Giáo Viên <ArrowRight size={16} />
            </button>
          </div>

          {/* Option 2: Student Client */}
          <div 
            className="glass-card" 
            style={{ 
              padding: '28px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: selectedRole === 'student' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
              background: selectedRole === 'student' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-elevated)',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleConfirm('student')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ 
                  width: '46px', 
                  height: '46px', 
                  borderRadius: '12px', 
                  background: 'rgba(16, 185, 129, 0.2)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)'
                }}>
                  <Monitor size={24} />
                </div>
                <span className="badge badge-ac">
                  Máy Trạm Học Sinh
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
                🎓 Máy Trạm Học Sinh
              </h3>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                Dành cho tất cả các máy tính con của Học sinh trong phòng máy. Nhẹ, không cần cài đặt thêm phần mềm gì.
              </p>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span><strong>Không cần cài MinGW / g++ / Code::Blocks</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Tự động quét mạng LAN tìm máy giáo viên</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Đọc đề thi PDF trực tiếp, viết code trong app</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Nộp bài, xem kết quả và bảng xếp hạng tức thì</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                padding: '11px', 
                fontWeight: 700, 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px' 
              }}
              onClick={(e) => { e.stopPropagation(); handleConfirm('student'); }}
            >
              Chọn Máy Này Làm Máy Học Sinh <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          💡 Bạn có thể dễ dàng chuyển đổi lại vai trò bất cứ lúc nào trong thanh trạng thái kết nối của ứng dụng.
        </div>
      </div>
    </div>
  );
};
