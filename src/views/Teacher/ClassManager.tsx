import React, { useState, useEffect } from 'react';
import { ClassGroup, User } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Users, 
  Plus, 
  Key, 
  GraduationCap, 
  Copy, 
  Check, 
  School, 
  Trash2, 
  RotateCcw, 
  UserPlus, 
  Sparkles, 
  FileSpreadsheet, 
  X, 
  CheckCircle2,
  Shield,
  Search
} from 'lucide-react';

export const ClassManager: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState('');

  // Selected Class to view / add students
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Modal: Add Single Student
  const [showAddSingleModal, setShowAddSingleModal] = useState(false);
  const [singleStudent, setSingleStudent] = useState({
    username: '',
    fullName: '',
    password: '123456',
    classId: ''
  });

  // Modal: Batch Quick Generate (e.g. hs01 -> hs40)
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    prefix: 'hs',
    startNum: 1,
    count: 35,
    password: '123456',
    classId: ''
  });

  // Modal: Paste Names from Excel
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteClassId, setPasteClassId] = useState('');

  const [notification, setNotification] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [serverUrl]);

  const fetchData = async () => {
    try {
      const [clsRes, usrRes] = await Promise.all([
        fetch(`${serverUrl}/api/classes`),
        fetch(`${serverUrl}/api/users`)
      ]);
      if (clsRes.ok) {
        const cList = await clsRes.json();
        setClasses(cList);
        if (cList.length > 0 && !singleStudent.classId) {
          setSingleStudent(prev => ({ ...prev, classId: cList[0].id }));
          setBatchForm(prev => ({ ...prev, classId: cList[0].id }));
          setPasteClassId(cList[0].id);
        }
      }
      if (usrRes.ok) setUsers(await usrRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const res = await fetch(`${serverUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClassName.trim(),
          teacher: newTeacherName.trim() || 'Giáo viên phụ trách'
        })
      });
      if (res.ok) {
        setNewClassName('');
        setNewTeacherName('');
        fetchData();
        showNotify('Đã tạo lớp học mới thành công!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Add Single Student
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudent.username.trim()) return;

    try {
      const res = await fetch(`${serverUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: singleStudent.username.trim().toLowerCase(),
          fullName: singleStudent.fullName.trim() || singleStudent.username.trim(),
          password: singleStudent.password || '123456',
          role: 'user',
          classId: singleStudent.classId || (classes[0]?.id || 'cls-1')
        })
      });

      if (res.ok) {
        setShowAddSingleModal(false);
        setSingleStudent({
          username: '',
          fullName: '',
          password: '123456',
          classId: classes[0]?.id || ''
        });
        fetchData();
        showNotify('Đã tạo tài khoản học sinh thành công!');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Lỗi tạo học sinh');
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Batch Quick Generate (hs01 -> hs40)
  const handleBatchGenerate = async () => {
    const list: Array<{ username: string; fullName: string; password: string; classId: string }> = [];
    const prefix = (batchForm.prefix || 'hs').trim().toLowerCase();
    const count = Number(batchForm.count) || 35;
    const start = Number(batchForm.startNum) || 1;

    for (let i = 0; i < count; i++) {
      const num = start + i;
      const uName = `${prefix}${String(num).padStart(2, '0')}`;
      list.push({
        username: uName,
        fullName: `Học sinh ${num}`,
        password: batchForm.password || '123456',
        classId: batchForm.classId || (classes[0]?.id || 'cls-1')
      });
    }

    try {
      const res = await fetch(`${serverUrl}/api/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: list,
          classId: batchForm.classId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setShowBatchModal(false);
        fetchData();
        showNotify(`Đã tự động tạo ${data.count} tài khoản học sinh từ ${prefix}${String(start).padStart(2, '0')} đến ${prefix}${String(start + count - 1).padStart(2, '0')}!`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Lỗi tạo hàng loạt');
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Paste Names List from Excel
  const handlePasteGenerate = async () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    const list: Array<{ username: string; fullName: string; password: string; classId: string }> = [];
    const classTarget = pasteClassId || (classes[0]?.id || 'cls-1');

    lines.forEach((line, idx) => {
      // Could be "Nguyễn Văn A" or "hs01, Nguyễn Văn A"
      let username = '';
      let fullName = '';
      if (line.includes(',') || line.includes('\t')) {
        const parts = line.split(/[,\t]/);
        username = parts[0].trim().toLowerCase().replace(/\s+/g, '_');
        fullName = parts[1]?.trim() || username;
      } else {
        fullName = line;
        username = `hs${String(idx + 1).padStart(2, '0')}`;
      }

      list.push({
        username,
        fullName,
        password: '123456',
        classId: classTarget
      });
    });

    try {
      const res = await fetch(`${serverUrl}/api/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: list,
          classId: classTarget
        })
      });

      if (res.ok) {
        const data = await res.json();
        setShowPasteModal(false);
        setPasteText('');
        fetchData();
        showNotify(`Đã nạp thành công ${data.count} học sinh từ danh sách!`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Lỗi nạp danh sách');
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Reset Student Password
  const handleResetPassword = async (user: User) => {
    if (!confirm(`Đặt lại mật khẩu của học sinh "${user.fullName} (@${user.username})" về mặc định "123456"?`)) return;

    try {
      const res = await fetch(`${serverUrl}/api/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: '123456' })
      });
      if (res.ok) {
        showNotify(`Đã đặt lại mật khẩu cho @${user.username} thành: 123456`);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (user: User) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản học sinh "${user.fullName} (@${user.username})"?`)) return;

    try {
      const res = await fetch(`${serverUrl}/api/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        showNotify(`Đã xóa tài khoản @${user.username}`);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Filtered Students
  const studentList = users.filter(u => {
    if (u.role === 'host') return false;
    if (selectedClassId !== 'all' && u.classId !== selectedClassId) return false;
    if (searchStudent) {
      const q = searchStudent.toLowerCase();
      return u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '0.88rem'
        }}>
          <CheckCircle2 size={18} /> {notification}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <School size={24} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Quản Lý Lớp Học & Tài Khoản Học Sinh</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Tạo lớp học, tạo danh sách tài khoản học sinh phòng máy hoặc để học sinh tự động đăng ký khi đăng nhập.
          </p>
        </div>

        {/* Action Buttons for Students */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowBatchModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Sparkles size={16} /> Tạo Nhanh Danh Sách (hs01 ➔ hs40)
          </button>

          <button 
            className="btn btn-secondary"
            onClick={() => setShowPasteModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileSpreadsheet size={16} /> Nạp Danh Sách Từ Excel
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => setShowAddSingleModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} /> Thêm 1 Học Sinh
          </button>
        </div>
      </div>

      {/* Auto-Join Explanation Notice */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))', 
        border: '1px solid rgba(99, 102, 241, 0.3)', 
        borderRadius: 'var(--radius-md)', 
        padding: '14px 18px', 
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <GraduationCap size={28} color="var(--primary-light)" />
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)', display: 'block' }}>
              💡 Mẹo dành cho phòng máy: Học sinh có thể Tự Động Tạo Tài Khoản khi đăng nhập lần đầu!
            </strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Giáo viên không nhất thiết phải gõ tạo tài khoản trước. Học sinh ở máy trạm chỉ cần mở app, gõ mã học sinh (VD: <code style={{ color: 'var(--accent-cyan)' }}>hs01</code>, <code style={{ color: 'var(--accent-cyan)' }}>nguyenvana</code>) và mật khẩu <code style={{ color: 'var(--accent-amber)' }}>123456</code>, hệ thống máy chủ sẽ <strong>tự động tạo tài khoản và ghi nhận vào lớp ngay lập tức</strong>!
            </span>
          </div>
        </div>
      </div>

      {/* Top Section: Create Class Form */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '18px 22px' }}>
        <h3 style={{ fontSize: '0.98rem', marginBottom: '12px', fontWeight: 700 }}>Thêm Lớp Học Mới</h3>
        <form onSubmit={handleCreateClass} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Tên lớp học (ví dụ: 10A1, 11 Tin Học, Đội Tuyển...)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            style={{ flex: 2, minWidth: '220px' }}
            required
          />
          <input
            type="text"
            className="input-field"
            placeholder="Giáo viên phụ trách (Thầy Nam...)"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
            style={{ flex: 1, minWidth: '180px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>
            <Plus size={16} /> Tạo Lớp
          </button>
        </form>
      </div>

      {/* Classes Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {classes.map((cls) => {
          const studentsInClass = users.filter(u => u.classId === cls.id && u.role === 'user');
          const isSelected = selectedClassId === cls.id;

          return (
            <div 
              key={cls.id} 
              className="glass-panel" 
              onClick={() => setSelectedClassId(isSelected ? 'all' : cls.id)}
              style={{ 
                padding: '16px 20px', 
                cursor: 'pointer',
                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{cls.name}</h3>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(99, 102, 241, 0.1)', 
                  border: '1px solid rgba(99, 102, 241, 0.25)', 
                  padding: '3px 8px', 
                  borderRadius: 'var(--radius-sm)' 
                }}>
                  <Key size={12} style={{ color: 'var(--primary-light)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                    {cls.joinCode}
                  </span>
                  <button 
                    className="btn btn-outline btn-sm"
                    style={{ padding: '2px', border: 'none', background: 'transparent' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCode(cls.joinCode, cls.id);
                    }}
                    title="Sao chép mã PIN"
                  >
                    {copiedId === cls.id ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Phụ trách: <strong>{cls.teacher}</strong>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                👥 {studentsInClass.length} học sinh trong lớp {isSelected ? '(Đang lọc)' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Students Management Section */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.15rem', margin: 0 }}>
              Danh Sách Tài Khoản Học Sinh ({studentList.length} em)
            </h3>
            {selectedClassId !== 'all' && (
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', fontSize: '0.75rem' }}>
                Đang lọc: {classes.find(c => c.id === selectedClassId)?.name}
                <X size={12} style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={() => setSelectedClassId('all')} />
              </span>
            )}
          </div>

          {/* Search student */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm theo tên hoặc mã HS..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* Students Table */}
        {studentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Chưa có học sinh nào. Bạn có thể bấm <strong>"Tạo Nhanh Danh Sách (hs01 ➔ hs40)"</strong> ở trên để tạo một loạt!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 14px' }}>STT</th>
                  <th style={{ padding: '10px 14px' }}>TÊN ĐĂNG NHẬP / MÃ HS</th>
                  <th style={{ padding: '10px 14px' }}>HỌ VÀ TÊN HỌC SINH</th>
                  <th style={{ padding: '10px 14px' }}>LỚP HỌC</th>
                  <th style={{ padding: '10px 14px' }}>MẬT KHẨU BAN ĐẦU</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((st, idx) => {
                  const studentClass = classes.find(c => c.id === st.classId);
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        @{st.username}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {st.fullName}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.78rem', background: 'var(--bg-surface-elevated)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          {studentClass?.name || 'Chưa gán lớp'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        123456
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleResetPassword(st)}
                            title="Đặt lại mật khẩu về 123456"
                          >
                            <RotateCcw size={12} /> Đặt lại MK
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--accent-rose)', padding: '4px 8px' }}
                            onClick={() => handleDeleteStudent(st)}
                            title="Xóa tài khoản này"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: TẠO 1 HỌC SINH ────────────────────────────── */}
      {showAddSingleModal && (
        <div className="modal-overlay" onClick={() => setShowAddSingleModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '440px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Thêm 1 Học Sinh Mới</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddSingleModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddSingleStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  TÊN ĐĂNG NHẬP / MÃ HỌC SINH *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="VD: hs01 hoặc nguyenvana"
                  value={singleStudent.username}
                  onChange={e => setSingleStudent({ ...singleStudent, username: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  HỌ VÀ TÊN HỌC SINH
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="VD: Nguyễn Văn An"
                  value={singleStudent.fullName}
                  onChange={e => setSingleStudent({ ...singleStudent, fullName: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  MẬT KHẨU BAN ĐẦU
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={singleStudent.password}
                  onChange={e => setSingleStudent({ ...singleStudent, password: e.target.value })}
                  placeholder="Mặc định: 123456"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  THUỘC LỚP HỌC
                </label>
                <select
                  className="input-field"
                  value={singleStudent.classId}
                  onChange={e => setSingleStudent({ ...singleStudent, classId: e.target.value })}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddSingleModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: 700 }}>
                  Lưu Học Sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: TẠO HÀNG LOẠT (hs01 -> hs40) ───────────────── */}
      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '480px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--primary-light)" />
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Tạo Nhanh Hàng Loạt Học Sinh</h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowBatchModal(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Hệ thống sẽ tự động tạo một loạt tài khoản theo số thứ tự phòng máy (Ví dụ: hs01, hs02, ... hs35) với mật khẩu mặc định <strong>123456</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TIỀN TỐ TÊN</label>
                  <input
                    type="text"
                    className="input-field"
                    value={batchForm.prefix}
                    onChange={e => setBatchForm({ ...batchForm, prefix: e.target.value })}
                    placeholder="VD: hs"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>SỐ LƯỢNG TÀI KHOẢN</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="input-field"
                    value={batchForm.count}
                    onChange={e => setBatchForm({ ...batchForm, count: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>GÁN VÀO LỚP HỌC</label>
                <select
                  className="input-field"
                  value={batchForm.classId}
                  onChange={e => setBatchForm({ ...batchForm, classId: e.target.value })}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}>
                Tài khoản sẽ được tạo: <strong style={{ color: 'var(--accent-cyan)' }}>{batchForm.prefix}01</strong> đến <strong style={{ color: 'var(--accent-cyan)' }}>{batchForm.prefix}{String(batchForm.count).padStart(2, '0')}</strong> • Mật khẩu: <strong>{batchForm.password}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowBatchModal(false)}>
                  Hủy
                </button>
                <button type="button" className="btn btn-primary" onClick={handleBatchGenerate} style={{ padding: '8px 20px', fontWeight: 700 }}>
                  Bắt Đầu Tạo ({batchForm.count} Học Sinh)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NẠP TỪ DANH SÁCH EXCEL ─────────────────────── */}
      {showPasteModal && (
        <div className="modal-overlay" onClick={() => setShowPasteModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '520px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="var(--accent-emerald)" />
                <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Nạp Danh Sách Học Sinh Từ Excel</h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowPasteModal(false)}>
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Dán cột danh sách họ tên học sinh từ file Excel hoặc Word (mỗi học sinh 1 dòng). Hệ thống sẽ tự động gán mã và mật khẩu mặc định <strong>123456</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  GÁN VÀO LỚP HỌC
                </label>
                <select
                  className="input-field"
                  value={pasteClassId}
                  onChange={e => setPasteClassId(e.target.value)}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  DÁN DANH SÁCH HỌ TÊN (Mỗi dòng một học sinh)
                </label>
                <textarea
                  className="input-field"
                  rows={8}
                  placeholder={`Nguyễn Văn An\nTrần Thị Bình\nLê Hoàng Nam\n...`}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  style={{ fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPasteModal(false)}>
                  Hủy
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={!pasteText.trim()}
                  onClick={handlePasteGenerate}
                  style={{ padding: '8px 20px', fontWeight: 700 }}
                >
                  Nạp Vào Lớp Học
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
