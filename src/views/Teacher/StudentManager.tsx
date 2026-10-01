import React, { useState, useEffect } from 'react';
import { User, ClassGroup, Contest, StudentAttendance, UserExamRecord, AttendanceStatus } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Key, 
  Lock, 
  Unlock, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  Trophy, 
  Sparkles, 
  RefreshCw, 
  X, 
  Check, 
  Timer, 
  ShieldAlert, 
  HelpCircle,
  Copy,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Calendar,
  Layers
} from 'lucide-react';

interface OnlineClient {
  socketId: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  ip: string;
  lastSeen: number;
}

export const StudentManager: React.FC = () => {
  const { serverUrl, socket } = useNetwork();

  // Navigation tab inside Student Manager: 'directory' (Học sinh & Tài khoản) or 'attendance' (Điểm danh & Kỳ thi)
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'attendance'>('directory');

  // Core Data
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [onlineList, setOnlineList] = useState<OnlineClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Directory Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'online' | 'offline' | 'locked'>('all');

  // Modals in Directory
  const [showAddSingleModal, setShowAddSingleModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState<User | null>(null);
  const [showPortfolioModal, setShowPortfolioModal] = useState<User | null>(null);
  const [studentHistory, setStudentHistory] = useState<UserExamRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Forms
  const [singleForm, setSingleForm] = useState({ username: '', fullName: '', classId: '', password: '123' });
  const [batchPrefix, setBatchPrefix] = useState('hs');
  const [batchFrom, setBatchFrom] = useState(1);
  const [batchTo, setBatchTo] = useState(40);
  const [batchClassId, setBatchClassId] = useState('');
  const [batchDefaultPassword, setBatchDefaultPassword] = useState('123456');
  const [pasteInput, setPasteInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('123456');

  // Attendance & Contest Management State
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [attendanceList, setAttendanceList] = useState<StudentAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'all' | AttendanceStatus>('all');
  
  // Contest Candidates Whitelist Modal
  const [showCandidatesModal, setShowCandidatesModal] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateClassFilter, setCandidateClassFilter] = useState<string>('all');

  // Extra Time Modal
  const [extraTimeTarget, setExtraTimeTarget] = useState<StudentAttendance | null>(null);
  const [extraMinutesInput, setExtraMinutesInput] = useState<number>(5);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Load Initial Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [resUsers, resClasses, resContests, resOnline] = await Promise.all([
        fetch(`${serverUrl}/api/users`),
        fetch(`${serverUrl}/api/classes`),
        fetch(`${serverUrl}/api/contests`),
        fetch(`${serverUrl}/api/users/online`)
      ]);

      if (resUsers.ok) setUsers(await resUsers.json());
      if (resClasses.ok) {
        const clsData = await resClasses.json();
        setClasses(clsData);
        if (clsData.length > 0) {
          setSingleForm(prev => ({ ...prev, classId: clsData[0].id }));
          setBatchClassId(clsData[0].id);
        }
      }
      if (resContests.ok) {
        const cts = await resContests.json();
        setContests(cts);
        if (cts.length > 0 && !selectedContestId) {
          // Select running contest or first contest
          const running = cts.find((c: Contest) => c.status === 'running');
          setSelectedContestId(running ? running.id : cts[0].id);
        }
      }
      if (resOnline.ok) {
        setOnlineList(await resOnline.json());
      }
    } catch (e) {
      console.error('Lỗi tải dữ liệu học sinh:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [serverUrl]);

  // Socket updates for real-time online presence
  useEffect(() => {
    if (!socket) return;
    const handleOnlineUpdate = (list: OnlineClient[]) => {
      setOnlineList(list);
    };
    const handleAttendanceUpdate = (data: any) => {
      if (data.contestId === selectedContestId) {
        loadAttendance(selectedContestId);
      }
    };

    socket.on('users:online_update', handleOnlineUpdate);
    socket.on('contest:attendance_changed', handleAttendanceUpdate);

    return () => {
      socket.off('users:online_update', handleOnlineUpdate);
      socket.off('contest:attendance_changed', handleAttendanceUpdate);
    };
  }, [socket, selectedContestId]);

  // Load Attendance for selected contest
  const loadAttendance = async (contestId: string) => {
    if (!contestId) return;
    try {
      setLoadingAttendance(true);
      const res = await fetch(`${serverUrl}/api/contests/${contestId}/attendance`);
      if (res.ok) {
        setAttendanceList(await res.json());
      }
    } catch (e) {
      console.error('Lỗi tải danh sách điểm danh:', e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    if (selectedContestId) {
      loadAttendance(selectedContestId);
    }
  }, [selectedContestId]);

  // Students list (exclude teacher/admin host accounts)
  const students = users.filter(u => u.role !== 'host');

  // Filtered Students in Directory
  const filteredStudents = students.filter(s => {
    if (selectedClassFilter !== 'all' && s.classId !== selectedClassFilter) return false;
    const isOnline = onlineList.some(o => o.userId === s.id);
    if (selectedStatusFilter === 'online' && !isOnline) return false;
    if (selectedStatusFilter === 'offline' && isOnline) return false;
    if (selectedStatusFilter === 'locked' && !s.isLocked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (s.fullName || '').toLowerCase().includes(q);
      const matchUser = (s.username || '').toLowerCase().includes(q);
      return matchName || matchUser;
    }
    return true;
  });

  // Online count
  const onlineCount = students.filter(s => onlineList.some(o => o.userId === s.id)).length;
  const lockedCount = students.filter(s => s.isLocked).length;

  // Selected Contest Object
  const currentContest = contests.find(c => c.id === selectedContestId);

  // Filtered Attendance List
  const filteredAttendance = attendanceList.filter(item => {
    if (attendanceStatusFilter !== 'all' && item.status !== attendanceStatusFilter) return false;
    if (attendanceSearch.trim()) {
      const q = attendanceSearch.toLowerCase();
      const matchName = (item.fullName || '').toLowerCase().includes(q);
      const matchUser = (item.username || '').toLowerCase().includes(q);
      return matchName || matchUser;
    }
    return true;
  });

  // Attendance counts
  const presentCount = attendanceList.filter(a => a.status === 'present').length;
  const absentExcusedCount = attendanceList.filter(a => a.status === 'absent_excused').length;
  const absentUnexcusedCount = attendanceList.filter(a => a.status === 'absent_unexcused').length;
  const submittedCount = attendanceList.filter(a => a.status === 'submitted').length;
  const suspendedCount = attendanceList.filter(a => a.status === 'suspended').length;

  // --- Handlers: Directory ---
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleForm.username.trim()) {
      alert('Vui lòng nhập tên đăng nhập');
      return;
    }
    try {
      const res = await fetch(`${serverUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: singleForm.username.trim().toLowerCase(),
          fullName: singleForm.fullName.trim() || singleForm.username.trim(),
          classId: singleForm.classId || classes[0]?.id,
          password: singleForm.password || '123456',
          role: 'user'
        })
      });
      if (res.ok) {
        setShowAddSingleModal(false);
        setSingleForm({ username: '', fullName: '', classId: classes[0]?.id || '', password: '123456' });
        loadData();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + (err.error || 'Không thể tạo học sinh'));
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleBatchGenerate = async () => {
    if (batchFrom > batchTo) {
      alert('Số bắt đầu phải nhỏ hơn hoặc bằng số kết thúc');
      return;
    }
    const list: any[] = [];
    for (let i = batchFrom; i <= batchTo; i++) {
      const numStr = String(i).padStart(2, '0');
      const uname = `${batchPrefix}${numStr}`.toLowerCase();
      list.push({
        username: uname,
        fullName: `Học sinh ${numStr}`,
        password: batchDefaultPassword,
        classId: batchClassId
      });
    }

    try {
      const res = await fetch(`${serverUrl}/api/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: list, classId: batchClassId })
      });
      if (res.ok) {
        setShowBatchModal(false);
        loadData();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + err.error);
      }
    } catch (e: any) {
      alert('Lỗi kết nối: ' + e.message);
    }
  };

  const handleBatchPasteImport = async () => {
    if (!pasteInput.trim()) {
      alert('Vui lòng dán danh sách học sinh');
      return;
    }
    const lines = pasteInput.split('\n');
    const parsed: any[] = [];

    lines.forEach((line, idx) => {
      const clean = line.trim();
      if (!clean) return;
      const parts = clean.split(/[\t,;]+/).map(p => p.trim());
      let username = '';
      let fullName = '';
      if (parts.length >= 2) {
        fullName = parts[0];
        username = parts[1];
      } else {
        username = parts[0];
        fullName = parts[0];
      }
      username = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (username) {
        parsed.push({
          username,
          fullName,
          password: batchDefaultPassword || '123456',
          classId: batchClassId
        });
      }
    });

    if (parsed.length === 0) {
      alert('Không nhận diện được học sinh nào. Định dạng mỗi dòng: Họ Và Tên [Tab] TênĐăngNhập');
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/api/users/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsed, classId: batchClassId })
      });
      if (res.ok) {
        setPasteInput('');
        setShowBatchModal(false);
        loadData();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + err.error);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleToggleLock = async (user: User) => {
    try {
      const res = await fetch(`${serverUrl}/api/users/${user.id}/toggle-lock`, { method: 'POST' });
      if (res.ok) {
        loadData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordResetModal) return;
    try {
      const res = await fetch(`${serverUrl}/api/users/${showPasswordResetModal.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPasswordInput })
      });
      if (res.ok) {
        alert(`Đã đặt lại mật khẩu cho ${showPasswordResetModal.username} thành: ${newPasswordInput}`);
        setShowPasswordResetModal(null);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa học sinh "${user.fullName}" (${user.username})?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleOpenPortfolio = async (user: User) => {
    setShowPortfolioModal(user);
    setLoadingHistory(true);
    try {
      const res = await fetch(`${serverUrl}/api/users/${user.id}/history`);
      if (res.ok) {
        setStudentHistory(await res.json());
      }
    } catch (e) {
      console.error('Lỗi tải lịch sử:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- Handlers: Attendance & Room Control ---
  const handleUpdateStatus = async (userId: string, newStatus: AttendanceStatus, reason?: string) => {
    if (!selectedContestId) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${selectedContestId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus, reason })
      });
      if (res.ok) {
        loadAttendance(selectedContestId);
      }
    } catch (e: any) {
      alert('Lỗi cập nhật điểm danh: ' + e.message);
    }
  };

  const handleApplyExtraTime = async () => {
    if (!selectedContestId || !extraTimeTarget) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${selectedContestId}/extra-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: extraTimeTarget.userId, extraMinutes: extraMinutesInput })
      });
      if (res.ok) {
        alert(`Đã cộng thêm ${extraMinutesInput} phút thi cho ${extraTimeTarget.fullName}`);
        setExtraTimeTarget(null);
        loadAttendance(selectedContestId);
      }
    } catch (e: any) {
      alert('Lỗi cộng giờ thi: ' + e.message);
    }
  };

  const handleReopenContest = async (item: StudentAttendance) => {
    if (!confirm(`Mở lại quyền làm bài thi cho thí sinh "${item.fullName}"?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${selectedContestId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.userId })
      });
      if (res.ok) {
        alert('Đã mở lại lượt thi thành công');
        loadAttendance(selectedContestId);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleSuspendStudent = async (item: StudentAttendance) => {
    const reason = prompt(`Nhập lý do đình chỉ thi đối với thí sinh "${item.fullName}":`, 'Vi phạm quy chế phòng thi');
    if (reason === null) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${selectedContestId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: item.userId, reason })
      });
      if (res.ok) {
        loadAttendance(selectedContestId);
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleOpenCandidatesModal = () => {
    if (!currentContest) return;
    // If contest has specific candidateIds, use them. Otherwise, initialize with all students in allowed classes
    if (currentContest.candidateIds && currentContest.candidateIds.length > 0) {
      setSelectedCandidateIds([...currentContest.candidateIds]);
    } else if (currentContest.classIds && currentContest.classIds.length > 0) {
      const allowed = students.filter(s => currentContest.classIds.includes(s.classId)).map(s => s.id);
      setSelectedCandidateIds(allowed);
    } else {
      setSelectedCandidateIds(students.map(s => s.id));
    }
    setShowCandidatesModal(true);
  };

  const handleSaveCandidates = async () => {
    if (!selectedContestId) return;
    try {
      const res = await fetch(`${serverUrl}/api/contests/${selectedContestId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: selectedCandidateIds })
      });
      if (res.ok) {
        setShowCandidatesModal(false);
        loadData();
        loadAttendance(selectedContestId);
      }
    } catch (e: any) {
      alert('Lỗi lưu danh sách thí sinh: ' + e.message);
    }
  };

  return (
    <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={26} color="var(--accent-cyan)" />
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Quản Lý Học Sinh & Phòng Thi
            </h1>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Quản trị tài khoản, điểm danh kỳ thi, giám sát máy trạm LAN và can thiệp sự cố phòng máy
          </div>
        </div>

        {/* Master Sub-Tabs Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', gap: '4px' }}>
          <button
            className={`btn btn-sm ${activeSubTab === 'directory' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', padding: '6px 14px' }}
            onClick={() => setActiveSubTab('directory')}
          >
            <Users size={14} /> Danh Sách & Tài Khoản ({students.length})
          </button>
          <button
            className={`btn btn-sm ${activeSubTab === 'attendance' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none', padding: '6px 14px' }}
            onClick={() => setActiveSubTab('attendance')}
          >
            <UserCheck size={14} /> Điểm Danh & Phòng Thi
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SUB-TAB 1: DANH SÁCH & TÀI KHOẢN HỌC SINH
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'directory' && (
        <>
          {/* Top Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Tổng Số Học Sinh</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{students.length}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                <Activity size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Đang Online LAN</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
                  {onlineCount} máy
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)' }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Số Lớp Học</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{classes.length}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-rose)' }}>
                <Lock size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Tài Khoản Bị Khóa</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: lockedCount > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                  {lockedCount}
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
              {/* Search box */}
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm tên, username..."
                  className="input-field"
                  style={{ paddingLeft: '32px', fontSize: '0.84rem', height: '36px' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Class Filter */}
              <select
                className="input-field"
                style={{ width: '150px', fontSize: '0.84rem', height: '36px' }}
                value={selectedClassFilter}
                onChange={e => setSelectedClassFilter(e.target.value)}
              >
                <option value="all">Tất cả lớp ({classes.length})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="input-field"
                style={{ width: '150px', fontSize: '0.84rem', height: '36px' }}
                value={selectedStatusFilter}
                onChange={e => setSelectedStatusFilter(e.target.value as any)}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="online">Đang Online</option>
                <option value="offline">Offline</option>
                <option value="locked">Bị khóa</option>
              </select>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCardsModal(true)}
                title="Xuất thẻ dự thi / danh sách tài khoản ra giấy in hoặc Excel"
              >
                <Printer size={14} /> In Thẻ Dự Thi
              </button>

              <button 
                className="btn btn-outline btn-sm"
                onClick={() => setShowBatchModal(true)}
              >
                <FileSpreadsheet size={14} /> Tạo Hàng Loạt (hs01-40)
              </button>

              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddSingleModal(true)}
              >
                <Plus size={14} /> Thêm Học Sinh
              </button>
            </div>
          </div>

          {/* Student Table */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <th style={{ padding: '12px 16px', width: '50px' }}>STT</th>
                  <th style={{ padding: '12px 16px' }}>Họ Và Tên</th>
                  <th style={{ padding: '12px 16px' }}>Tên Đăng Nhập</th>
                  <th style={{ padding: '12px 16px' }}>Lớp</th>
                  <th style={{ padding: '12px 16px' }}>Trạng Thái Máy Trạm LAN</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy học sinh nào phù hợp bộ lọc
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s, idx) => {
                    const cls = classes.find(c => c.id === s.classId);
                    const live = onlineList.find(o => o.userId === s.id);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: s.isLocked ? 'rgba(244, 63, 94, 0.04)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-light), var(--accent-cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.74rem', fontWeight: 700 }}>
                              {s.fullName?.charAt(0).toUpperCase() || s.username.charAt(0).toUpperCase()}
                            </div>
                            <span>{s.fullName}</span>
                            {s.isLocked && (
                              <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: '0.7rem' }}>
                                Bị khóa
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                          {s.username}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', fontSize: '0.75rem' }}>
                            {cls ? cls.name : 'Chưa xếp lớp'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {live ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 600 }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                              Online • IP: {live.ip || '127.0.0.1'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              Offline
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleOpenPortfolio(s)}
                              title="Xem học bạ & kết quả qua các kỳ thi"
                            >
                              <TrendingUp size={13} /> Học Bạ
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => {
                                setShowPasswordResetModal(s);
                                setNewPasswordInput('123456');
                              }}
                              title="Đổi mật khẩu tài khoản"
                            >
                              <Key size={13} /> Đổi MK
                            </button>
                            <button
                              className={`btn btn-sm ${s.isLocked ? 'btn-primary' : 'btn-outline'}`}
                              style={{ padding: '4px 8px', fontSize: '0.74rem', color: s.isLocked ? '#fff' : 'var(--accent-amber)' }}
                              onClick={() => handleToggleLock(s)}
                              title={s.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản (ngăn đăng nhập)'}
                            >
                              {s.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleDeleteUser(s)}
                              title="Xóa học sinh"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SUB-TAB 2: ĐIỂM DANH & ĐIỀU PHỐI KỲ THI
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'attendance' && (
        <>
          {/* Contest Selector Bar */}
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '320px' }}>
              <Trophy size={20} color="var(--accent-amber)" />
              <div style={{ minWidth: '100px', fontSize: '0.88rem', fontWeight: 700 }}>Chọn Kỳ Thi:</div>
              <select
                className="input-field"
                style={{ flex: 1, height: '40px', fontWeight: 600 }}
                value={selectedContestId}
                onChange={e => setSelectedContestId(e.target.value)}
              >
                {contests.length === 0 && <option value="">(Chưa có kỳ thi nào)</option>}
                {contests.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.status === 'running' ? 'ĐANG THI' : c.status === 'upcoming' ? 'SẮP THI' : 'ĐÃ KẾT THÚC'}] {c.title} • {c.mode.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleOpenCandidatesModal}
                disabled={!selectedContestId}
                title="Chọn danh sách thí sinh được phép vào thi (Theo lớp hoặc từng cá nhân)"
              >
                <UserCheck size={14} /> Cấu Hình Thí Sinh ({attendanceList.length})
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReportModal(true)}
                disabled={!selectedContestId}
                title="Xuất biên bản điểm danh phòng máy & danh sách vắng thi"
              >
                <FileText size={14} /> Xuất Báo Cáo Vắng
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => selectedContestId && loadAttendance(selectedContestId)}
                title="Làm mới trạng thái"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Attendance Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tổng Thí Sinh Dự Thi</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '2px' }}>{attendanceList.length}</div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--accent-emerald)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Có Mặt (Đang Thi)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                {presentCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--accent-amber)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Vắng Có Phép</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
                {absentExcusedCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--accent-rose)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Vắng Không Phép</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '2px' }}>
                {absentUnexcusedCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--primary-light)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Đã Nộp Bài</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary-light)', marginTop: '2px' }}>
                {submittedCount}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Đình Chỉ Thi</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                {suspendedCount}
              </div>
            </div>
          </div>

          {/* Attendance Search & Status Filter */}
          <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Lọc thí sinh theo tên, SBD..."
                  className="input-field"
                  style={{ paddingLeft: '32px', height: '34px', fontSize: '0.84rem' }}
                  value={attendanceSearch}
                  onChange={e => setAttendanceSearch(e.target.value)}
                />
              </div>

              <select
                className="input-field"
                style={{ width: '180px', height: '34px', fontSize: '0.84rem' }}
                value={attendanceStatusFilter}
                onChange={e => setAttendanceStatusFilter(e.target.value as any)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="present">Có mặt (Đang thi)</option>
                <option value="absent_excused">Vắng (Có phép)</option>
                <option value="absent_unexcused">Vắng (Không phép)</option>
                <option value="submitted">Đã nộp bài</option>
                <option value="suspended">Đình chỉ thi</option>
              </select>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Nhấp vào trạng thái để điểm danh nhanh • Bấm <strong>+ Giờ Bù</strong> để hỗ trợ sự cố máy
            </div>
          </div>

          {/* Attendance Table */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <th style={{ padding: '12px 14px', width: '45px' }}>STT</th>
                  <th style={{ padding: '12px 14px' }}>Thí Sinh</th>
                  <th style={{ padding: '12px 14px' }}>Lớp</th>
                  <th style={{ padding: '12px 14px' }}>Máy Con (LAN)</th>
                  <th style={{ padding: '12px 14px' }}>Điểm & Bài Nộp</th>
                  <th style={{ padding: '12px 14px', width: '210px' }}>Trạng Thái Điểm Danh</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Xử Lý Sự Cố Phòng Máy</th>
                </tr>
              </thead>
              <tbody>
                {loadingAttendance ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Đang tải danh sách thí sinh và trạng thái kết nối...
                    </td>
                  </tr>
                ) : filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không có thí sinh nào trong ca thi này. Hãy bấm <strong>"Cấu Hình Thí Sinh"</strong> để chọn học sinh vào thi.
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((item, idx) => {
                    const cls = classes.find(c => c.id === item.classId);
                    return (
                      <tr 
                        key={item.userId} 
                        style={{ 
                          borderBottom: '1px solid var(--border-subtle)',
                          background: item.status === 'suspended' ? 'rgba(239, 68, 68, 0.08)' : 
                                      item.status === 'absent_unexcused' ? 'rgba(244, 63, 94, 0.03)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{item.fullName}</div>
                          <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            {item.username}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="badge" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', fontSize: '0.74rem' }}>
                            {cls ? cls.name : 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {item.isOnline ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--accent-emerald)', fontSize: '0.78rem', fontWeight: 600 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                              Online ({item.ip || 'LAN'})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                              Chưa vào phòng thi
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>
                            {item.currentScore || 0} điểm
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.submissionsCount || 0} lần nộp
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select
                            className="input-field"
                            style={{ 
                              height: '32px', 
                              fontSize: '0.8rem', 
                              fontWeight: 600,
                              borderColor: item.status === 'present' ? 'var(--accent-emerald)' :
                                           item.status === 'absent_excused' ? 'var(--accent-amber)' :
                                           item.status === 'absent_unexcused' ? 'var(--accent-rose)' :
                                           item.status === 'submitted' ? 'var(--primary-light)' : '#ef4444'
                            }}
                            value={item.status}
                            onChange={e => handleUpdateStatus(item.userId, e.target.value as AttendanceStatus)}
                          >
                            <option value="present">🟢 Có mặt (Đang thi)</option>
                            <option value="absent_excused">🟡 Vắng (Có phép)</option>
                            <option value="absent_unexcused">🔴 Vắng (Không phép)</option>
                            <option value="submitted">🔵 Đã nộp bài</option>
                            <option value="suspended">⛔ Đình chỉ thi</option>
                          </select>
                          {item.extraMinutes > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '2px', fontWeight: 600 }}>
                              Được bù: +{item.extraMinutes} phút
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', color: 'var(--accent-cyan)' }}
                              onClick={() => {
                                setExtraTimeTarget(item);
                                setExtraMinutesInput(5);
                              }}
                              title="Cộng bù thêm giờ thi cho học sinh này khi gặp sự cố máy"
                            >
                              <Timer size={13} /> + Giờ Bù
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleReopenContest(item)}
                              title="Mở lại lượt thi nếu học sinh nộp nhầm hoặc đổi máy"
                            >
                              Mở Lại
                            </button>

                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                              onClick={() => handleSuspendStudent(item)}
                              title="Đình chỉ thi ngay lập tức do vi phạm quy chế"
                            >
                              <ShieldAlert size={13} /> Đình Chỉ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: CẤU HÌNH THÍ SINH DỰ THI (CANDIDATE WHITELIST)
          ═══════════════════════════════════════════════════════════════════ */}
      {showCandidatesModal && currentContest && (
        <div className="modal-overlay" onClick={() => setShowCandidatesModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '780px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Cấu Hình Thí Sinh Dự Thi: {currentContest.title}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Tích chọn những học sinh được phép tham gia ca thi này ({selectedCandidateIds.length}/{students.length} em)
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCandidatesModal(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Quick Actions & Class Filter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lọc theo lớp:</span>
                <select
                  className="input-field"
                  style={{ height: '32px', fontSize: '0.82rem', width: '140px' }}
                  value={candidateClassFilter}
                  onChange={e => setCandidateClassFilter(e.target.value)}
                >
                  <option value="all">Tất cả lớp</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem' }}
                  onClick={() => {
                    const toSelect = students
                      .filter(s => candidateClassFilter === 'all' || s.classId === candidateClassFilter)
                      .map(s => s.id);
                    const merged = Array.from(new Set([...selectedCandidateIds, ...toSelect]));
                    setSelectedCandidateIds(merged);
                  }}
                >
                  <Check size={13} /> Chọn Hết Lớp Này
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.76rem' }}
                  onClick={() => {
                    const toRemove = students
                      .filter(s => candidateClassFilter === 'all' || s.classId === candidateClassFilter)
                      .map(s => s.id);
                    setSelectedCandidateIds(selectedCandidateIds.filter(id => !toRemove.includes(id)));
                  }}
                >
                  Bỏ Chọn Lớp Này
                </button>
              </div>
            </div>

            {/* Student Checkbox List */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                {students
                  .filter(s => candidateClassFilter === 'all' || s.classId === candidateClassFilter)
                  .map(s => {
                    const isChecked = selectedCandidateIds.includes(s.id);
                    const cls = classes.find(c => c.id === s.classId);
                    return (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px',
                          borderRadius: 'var(--radius-sm)',
                          background: isChecked ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isChecked ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedCandidateIds([...selectedCandidateIds, s.id]);
                            } else {
                              setSelectedCandidateIds(selectedCandidateIds.filter(id => id !== s.id));
                            }
                          }}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {s.fullName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{s.username}</span>
                            <span>•</span>
                            <span>{cls?.name || 'Lớp'}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-medium)', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Đã chọn: <strong style={{ color: 'var(--accent-cyan)' }}>{selectedCandidateIds.length} thí sinh</strong> tham gia ca thi
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCandidatesModal(false)}>
                  Hủy Bỏ
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveCandidates}>
                  <Check size={14} /> Lưu Danh Sách Thí Sinh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: CỘNG GIỜ THI BÙ (EXTRA TIME)
          ═══════════════════════════════════════════════════════════════════ */}
      {extraTimeTarget && (
        <div className="modal-overlay" onClick={() => setExtraTimeTarget(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '100%', maxWidth: '420px', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <Timer size={22} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Cộng Giờ Thi Bù Riêng</h3>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Học sinh: <strong style={{ color: 'var(--text-main)' }}>{extraTimeTarget.fullName}</strong> ({extraTimeTarget.username})
              <br />
              Đồng hồ đếm ngược trên máy của học sinh này sẽ tự động nhảy thêm số phút được cộng ngay lập tức.
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                CHỌN SỐ PHÚT BÙ SỰ CỐ:
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {[5, 10, 15, 20].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className={`btn btn-sm ${extraMinutesInput === mins ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, padding: '6px 0' }}
                    onClick={() => setExtraMinutesInput(mins)}
                  >
                    +{mins}p
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem' }}>Hoặc nhập số phút:</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="input-field"
                  style={{ width: '90px', height: '34px' }}
                  value={extraMinutesInput}
                  onChange={e => setExtraMinutesInput(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setExtraTimeTarget(null)}>Hủy</button>
              <button className="btn btn-primary btn-sm" onClick={handleApplyExtraTime}>
                Xác Nhận Cộng Giờ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: BÁO CÁO ĐIỂM DANH & VẮNG THI (REPORT)
          ═══════════════════════════════════════════════════════════════════ */}
      {showReportModal && currentContest && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '26px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={22} color="var(--primary-light)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Biên Bản Điểm Danh & Vắng Thi</h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowReportModal(false)}><X size={15} /></button>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', marginBottom: '18px', fontSize: '0.84rem' }}>
              <div><strong>Kỳ thi:</strong> {currentContest.title}</div>
              <div><strong>Thời gian:</strong> {new Date(currentContest.startTime).toLocaleString('vi-VN')}</div>
              <div><strong>Tổng thí sinh đăng ký:</strong> {attendanceList.length} em</div>
              <div>
                <strong>Tình hình dự thi:</strong> Có mặt: {presentCount} • Vắng có phép: {absentExcusedCount} • Vắng không phép: {absentUnexcusedCount} • Đã nộp: {submittedCount} • Đình chỉ: {suspendedCount}
              </div>
            </div>

            {/* List of absent students */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>
              Danh Sách Thí Sinh Vắng Thi ({absentExcusedCount + absentUnexcusedCount} em):
            </h4>
            {attendanceList.filter(a => a.status === 'absent_excused' || a.status === 'absent_unexcused').length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                Không có học sinh nào vắng thi (100% tham gia đầy đủ)
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>STT</th>
                      <th style={{ padding: '8px 12px' }}>Họ Và Tên</th>
                      <th style={{ padding: '8px 12px' }}>Tài Khoản</th>
                      <th style={{ padding: '8px 12px' }}>Lớp</th>
                      <th style={{ padding: '8px 12px' }}>Loại Vắng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceList
                      .filter(a => a.status === 'absent_excused' || a.status === 'absent_unexcused')
                      .map((a, i) => {
                        const cls = classes.find(c => c.id === a.classId);
                        return (
                          <tr key={a.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px' }}>{i + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.fullName}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{a.username}</td>
                            <td style={{ padding: '8px 12px' }}>{cls?.name || 'N/A'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {a.status === 'absent_excused' ? (
                                <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Vắng Có Phép</span>
                              ) : (
                                <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>Vắng Không Phép</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const text = attendanceList
                    .filter(a => a.status === 'absent_excused' || a.status === 'absent_unexcused')
                    .map((a, i) => `${i + 1}. ${a.fullName} (${a.username}) - ${a.status === 'absent_excused' ? 'Có phép' : 'Không phép'}`)
                    .join('\n');
                  navigator.clipboard.writeText(`BÁO CÁO VẮNG THI: ${currentContest.title}\n${text}`);
                  alert('Đã sao chép danh sách vắng thi vào bộ nhớ tạm!');
                }}
              >
                <Copy size={13} /> Sao Chép Danh Sách
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                <Printer size={13} /> In Báo Cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: HỌC BẠ & LỊCH SỬ THI TỔNG KẾT
          ═══════════════════════════════════════════════════════════════════ */}
      {showPortfolioModal && (
        <div className="modal-overlay" onClick={() => setShowPortfolioModal(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '780px', maxHeight: '88vh', overflowY: 'auto', padding: '26px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={22} color="var(--accent-cyan)" />
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                    Học Bạ Số: {showPortfolioModal.fullName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    @{showPortfolioModal.username}
                  </div>
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowPortfolioModal(null)}><X size={15} /></button>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Đang tổng hợp dữ liệu các kỳ thi...
              </div>
            ) : studentHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Học sinh này chưa tham gia kỳ thi nào
              </div>
            ) : (
              <div>
                {/* Stats summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tổng Số Kỳ Thi</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{studentHistory.length}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Điểm Trung Bình</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                      {(studentHistory.reduce((a, b) => a + (b.score || 0), 0) / studentHistory.length).toFixed(1)}đ
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Số Bài Giải Được (AC)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                      {studentHistory.reduce((a, b) => a + (b.problemsSolved || 0), 0)} bài
                    </div>
                  </div>
                </div>

                {/* History table */}
                <div style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                        <th style={{ padding: '10px 14px' }}>Thời Gian</th>
                        <th style={{ padding: '10px 14px' }}>Tên Kỳ Thi</th>
                        <th style={{ padding: '10px 14px' }}>Điểm Đạt Được</th>
                        <th style={{ padding: '10px 14px' }}>Thứ Hạng</th>
                        <th style={{ padding: '10px 14px' }}>Bài AC</th>
                        <th style={{ padding: '10px 14px' }}>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentHistory.map(rec => (
                        <tr key={rec.contestId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {new Date(rec.date).toLocaleDateString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{rec.contestTitle}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent-amber)' }}>
                            {rec.score}đ
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {rec.rank > 0 ? (
                              <span className="badge" style={{ background: rec.rank === 1 ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-app)', color: rec.rank === 1 ? '#eab308' : 'inherit' }}>
                                #{rec.rank}/{rec.totalParticipants}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                            {rec.problemsSolved}/{rec.totalProblems}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {rec.status === 'present' || rec.status === 'submitted' ? (
                              <span style={{ color: 'var(--accent-emerald)', fontSize: '0.78rem' }}>Đã thi</span>
                            ) : rec.status === 'suspended' ? (
                              <span style={{ color: '#ef4444', fontSize: '0.78rem' }}>Đình chỉ</span>
                            ) : (
                              <span style={{ color: 'var(--accent-rose)', fontSize: '0.78rem' }}>Vắng thi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: IN THẺ DỰ THI / TÀI KHOẢN HỌC SINH
          ═══════════════════════════════════════════════════════════════════ */}
      {showCardsModal && (
        <div className="modal-overlay" onClick={() => setShowCardsModal(false)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '26px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={22} color="var(--primary-light)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Thẻ Dự Thi & Danh Sách Tài Khoản</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Printer size={13} /> In Thẻ (Print)
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowCardsModal(false)}><X size={15} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {filteredStudents.map((s, idx) => {
                const cls = classes.find(c => c.id === s.classId);
                return (
                  <div 
                    key={s.id} 
                    style={{ 
                      border: '1.5px solid var(--border-medium)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '12px 14px', 
                      background: 'var(--bg-app)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>THẺ DỰ THI LAN</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SBD #{idx + 1}</span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.94rem', marginBottom: '4px' }}>{s.fullName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Lớp: <strong>{cls?.name || 'N/A'}</strong></div>
                    <div style={{ fontSize: '0.8rem', marginTop: '6px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                      <div>User: <strong style={{ color: 'var(--accent-cyan)' }}>{s.username}</strong></div>
                      <div>Pass: <strong style={{ color: 'var(--accent-amber)' }}>123456</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: THÊM HỌC SINH ĐƠN LẺ
          ═══════════════════════════════════════════════════════════════════ */}
      {showAddSingleModal && (
        <div className="modal-overlay" onClick={() => setShowAddSingleModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '26px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Thêm Học Sinh Mới</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddSingleModal(false)}><X size={15} /></button>
            </div>

            <form onSubmit={handleAddSingle}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>HỌ VÀ TÊN</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="input-field"
                  value={singleForm.fullName}
                  onChange={e => setSingleForm({ ...singleForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>TÊN ĐĂNG NHẬP (USERNAME)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: an_nv hoặc hs01"
                  className="input-field"
                  value={singleForm.username}
                  onChange={e => setSingleForm({ ...singleForm, username: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>LỚP HỌC</label>
                <select
                  className="input-field"
                  value={singleForm.classId}
                  onChange={e => setSingleForm({ ...singleForm, classId: e.target.value })}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>MẬT KHẨU BAN ĐẦU</label>
                <input
                  type="text"
                  className="input-field"
                  value={singleForm.password}
                  onChange={e => setSingleForm({ ...singleForm, password: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddSingleModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary btn-sm">Tạo Tài Khoản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: TẠO HÀNG LOẠT (BATCH HS01..HS40 / EXCEL)
          ═══════════════════════════════════════════════════════════════════ */}
      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '26px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Tạo Tài Khoản Học Sinh Hàng Loạt</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowBatchModal(false)}><X size={15} /></button>
            </div>

            {/* Target Class & Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CHỌN LỚP</label>
                <select className="input-field" value={batchClassId} onChange={e => setBatchClassId(e.target.value)}>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>MẬT KHẨU MẶC ĐỊNH</label>
                <input
                  type="text"
                  className="input-field"
                  value={batchDefaultPassword}
                  onChange={e => setBatchDefaultPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Method 1: Range Generation */}
            <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: '8px' }}>
                Cách 1: Tạo Tự Động Theo Dải Số (hs01 - hs40)
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '90px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tiền tố</label>
                  <input
                    type="text"
                    className="input-field"
                    value={batchPrefix}
                    onChange={e => setBatchPrefix(e.target.value)}
                    style={{ height: '34px' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Từ số</label>
                  <input
                    type="number"
                    className="input-field"
                    value={batchFrom}
                    onChange={e => setBatchFrom(Number(e.target.value))}
                    style={{ height: '34px' }}
                  />
                </div>
                <div style={{ width: '80px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Đến số</label>
                  <input
                    type="number"
                    className="input-field"
                    value={batchTo}
                    onChange={e => setBatchTo(Number(e.target.value))}
                    style={{ height: '34px' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-end', height: '34px' }}
                  onClick={handleBatchGenerate}
                >
                  Tạo {batchTo - batchFrom + 1} Tài Khoản
                </button>
              </div>
            </div>

            {/* Method 2: Paste from Excel */}
            <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: '4px' }}>
                Cách 2: Dán Danh Sách Từ Excel
              </strong>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Định dạng mỗi dòng: Họ Và Tên [Tab] TênĐăngNhập
              </div>
              <textarea
                className="input-field"
                style={{ height: '110px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                placeholder="Nguyễn Văn A	hs01&#10;Trần Thị B	hs02"
                value={pasteInput}
                onChange={e => setPasteInput(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '8px', width: '100%' }}
                onClick={handleBatchPasteImport}
              >
                Nhập Danh Sách Này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: RESET MẬT KHẨU
          ═══════════════════════════════════════════════════════════════════ */}
      {showPasswordResetModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordResetModal(null)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Key size={20} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Đổi Mật Khẩu Học Sinh</h3>
            </div>

            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Học sinh: <strong>{showPasswordResetModal.fullName}</strong> (@{showPasswordResetModal.username})
            </div>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>MẬT KHẨU MỚI</label>
                <input
                  type="text"
                  className="input-field"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPasswordResetModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary btn-sm">Lưu Mật Khẩu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
