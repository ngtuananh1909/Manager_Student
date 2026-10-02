import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { DiagnosticsInfo } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { 
  Server, 
  Cpu, 
  ShieldCheck, 
  Settings, 
  RefreshCw, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Radio, 
  Clock, 
  Wifi,
  ArrowUpCircle,
  FolderOpen,
  UploadCloud
} from 'lucide-react';

export const JudgeSettings: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [diag, setDiag] = useState<DiagnosticsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [compilerPath, setCompilerPath] = useState('');
  const [serverName, setServerName] = useState('');
  const [contestMode, setContestMode] = useState(false);
  const [freezeScoreboard, setFreezeScoreboard] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'direct' | 'batch'>('direct');
  const [submissionsClosed, setSubmissionsClosed] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Auto-Update State
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('1.0.8');
  const [updateServerInfo, setUpdateServerInfo] = useState<any>(null);
  const [publishMessage, setPublishMessage] = useState<string>('');

  useEffect(() => {
    fetchDiagnostics();
    fetchUpdateInfo();
    if ((window as any).electronAPI?.getAppVersion) {
      (window as any).electronAPI.getAppVersion().then((v: string) => setCurrentAppVersion(v));
    }
  }, [serverUrl]);

  const fetchUpdateInfo = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/update/info`);
      if (res.ok) {
        const info = await res.json();
        setUpdateServerInfo(info);
      }
    } catch (e) {}
  };

  const handlePublishUpdate = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.publishUpdateFile) {
      alert('Chức năng này chỉ khả dụng khi chạy trên ứng dụng ChauCaoJudge LAN Desktop.');
      return;
    }

    try {
      const res = await electronAPI.publishUpdateFile();
      if (res.canceled) return;

      if (res.success) {
        setPublishMessage(`Đã phát hành thành công: ${res.fileName} (${res.sizeMB} MB)`);
        fetchUpdateInfo();

        // Broadcast to all students via server
        await apiFetch(`${serverUrl}/api/update/broadcast`, { method: 'POST' });
        setTimeout(() => setPublishMessage(''), 5000);
      } else {
        alert('Lỗi phát hành file: ' + (res.error || 'Lỗi không xác định'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleOpenUpdatesFolder = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openUpdatesFolder) {
      await electronAPI.openUpdatesFolder();
    } else {
      alert('Chức năng này chỉ khả dụng trên ứng dụng Desktop.');
    }
  };

  const handleTriggerCheckUpdate = () => {
    window.dispatchEvent(new Event('check-app-update-now'));
  };

  const fetchDiagnostics = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/diagnostics`);
      if (res.ok) {
        const data: DiagnosticsInfo = await res.json();
        setDiag(data);
        setCompilerPath(data.settings.compilerPath || 'g++');
        setServerName(data.settings.serverName || 'Phòng Máy Chấm C++ Nội Bộ');
        setContestMode(data.settings.contestMode || false);
        setFreezeScoreboard(data.settings.freezeScoreboard || false);
        setSubmissionMode(data.settings.submissionMode || 'direct');
        setSubmissionsClosed(!!data.settings.submissionsClosed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${serverUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName,
          compilerPath,
          contestMode,
          freezeScoreboard,
          submissionMode,
          submissionsClosed
        })
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        fetchDiagnostics();
      }
    } catch (e) {
      alert('Lỗi cập nhật cấu hình: ' + e);
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={24} style={{ color: 'var(--primary-light)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Cấu Hình Máy Chấm & Môi Trường Sandbox</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Quản lý trình biên dịch C++, chế độ bảo mật Sandbox Docker / Native, và Chế độ thi đấu (Contest Mode)
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={fetchDiagnostics}>
          <RefreshCw size={14} /> Kiểm tra lại
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang kiểm tra hệ thống...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Diagnostic Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Docker Status */}
            <div className="glass-card" style={{ 
              borderLeft: `4px solid ${diag?.hasDocker ? 'var(--accent-emerald)' : 'var(--accent-amber)'}` 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>DOCKER CONTAINER SANDBOX</span>
                {diag?.hasDocker ? (
                  <span className="badge badge-ac">Đang Hoạt Động</span>
                ) : (
                  <span className="badge badge-tle">Chưa Cài Đặt</span>
                )}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                {diag?.hasDocker ? diag.dockerVersion : 'Sử dụng Native Watchdog Sandbox'}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {diag?.hasDocker 
                  ? 'Cô lập tuyệt đối qua container gcc:latest, cgroups và không có quyền truy cập mạng' 
                  : 'Hệ thống tự động sử dụng Sandbox giới hạn thời gian & bộ nhớ trên tiến trình nội bộ'}
              </p>
            </div>

            {/* G++ Compiler Status */}
            <div className="glass-card" style={{ 
              borderLeft: `4px solid ${diag?.hasGpp ? 'var(--accent-emerald)' : 'var(--accent-cyan)'}` 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TRÌNH BIÊN DỊCH C++ (G++)</span>
                {diag?.hasGpp ? (
                  <span className="badge badge-ac">Đã Nhận Diện</span>
                ) : (
                  <span className="badge badge-tle">Chế Độ Giả Lập</span>
                )}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {diag?.hasGpp ? diag.gppVersion : 'Built-in Emulator / Fallback Active'}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {diag?.hasGpp 
                  ? `Đường dẫn: ${diag.gppPath}` 
                  : 'Chế độ giả lập thông minh đang chạy sẵn sàng để thử nghiệm UI và chấm bài'}
              </p>
            </div>

            {/* LAN Beacon Status */}
            <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PHÁT BEACON MẠNG LAN</span>
                <span className="badge badge-ac">Đang Phát Sóng</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Cổng UDP 41234 & HTTP 4000
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Các máy học sinh trong cùng mạng WiFi / mạng dây trường học có thể tự động dò thấy máy này
              </p>
            </div>
          </div>

          {/* Settings Form */}
          <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '18px' }}>Cấu Hình Máy Chủ & Kỳ Thi</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  TÊN PHÒNG MÁY CHỦ HIỂN THỊ TRÊN MẠNG LAN
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Ví dụ: Phòng Máy 1 - Thầy Nam (10A1)"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  ĐƯỜNG DẪN TRÌNH BIÊN DỊCH G++ (NẾU CẦN CHỈ ĐỊNH)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={compilerPath}
                  onChange={(e) => setCompilerPath(e.target.value)}
                  placeholder="g++ hoặc C:\MinGW\bin\g++.exe"
                />
              </div>
            </div>

            {/* Submission & Grading Mode Settings */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-cyan)' }}>
                CHẾ ĐỘ CHẤM BÀI & THU BÀI (GRADING & SUBMISSION MODE)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="radio"
                      name="submissionMode"
                      value="direct"
                      checked={submissionMode === 'direct'}
                      onChange={() => setSubmissionMode('direct')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Chế độ Chấm Trực Tiếp (Mặc định)</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Học sinh nộp bài sẽ được máy chấm đưa vào hàng đợi chấm ngay lập tức và xem kết quả tức thì.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="radio"
                      name="submissionMode"
                      value="batch"
                      checked={submissionMode === 'batch'}
                      onChange={() => setSubmissionMode('batch')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong>Chế độ Nộp Bài (Thi đấu / Thu bài kiểm tra)</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Học sinh nộp bài sẽ chỉ được thu thập trên hệ thống (chưa chấm ngay). Giáo viên đóng thời gian nộp bài rồi vào màn hình <strong>Giám sát</strong> bấm nút <strong>"Chấm Tất Cả"</strong> để chấm hàng loạt kèm thanh tiến trình.
                      </div>
                    </div>
                  </label>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={submissionsClosed}
                      onChange={(e) => setSubmissionsClosed(e.target.checked)}
                    />
                    <span style={{ color: submissionsClosed ? 'var(--accent-rose)' : 'inherit' }}>
                      <strong>Đóng Cổng Nộp Bài</strong> (Khóa không cho học sinh nộp thêm bài mới sau khi hết giờ thi)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Contest Mode Switches */}
            <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>
                CHẾ ĐỘ THI ĐẤU (CONTEST MODE)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={contestMode}
                    onChange={(e) => setContestMode(e.target.checked)}
                  />
                  <span>
                    <strong>Kích hoạt Chế độ Thi đấu</strong> (Khóa xem kết quả test chi tiết của học sinh cho đến khi hết giờ thi)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={freezeScoreboard}
                    onChange={(e) => setFreezeScoreboard(e.target.checked)}
                  />
                  <span>
                    <strong>Đóng băng Bảng Xếp Hạng (Freeze Scoreboard)</strong> (Ẩn cập nhật điểm trong 15 phút cuối trận thi để tăng kịch tính)
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                {savedSuccess && (
                  <span style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={15} /> Đã lưu và áp dụng cấu hình thành công!
                  </span>
                )}
              </div>
              <button type="submit" className="btn btn-primary">
                <Save size={16} /> Lưu Thay Đổi Cấu Hình
              </button>
            </div>
          </form>

          {/* ======================================== */}
          {/* LAN AUTO-UPDATE MANAGEMENT CARD          */}
          {/* ======================================== */}
          <div className="glass-card" style={{ marginTop: '8px', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ArrowUpCircle size={22} style={{ color: '#6366f1' }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Cập Nhật Phần Mềm Tự Động Qua LAN</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                    Phát hành và phân phối bản cập nhật cho toàn bộ máy học sinh trong phòng máy
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
                  Phiên bản hiện tại: v{currentAppVersion}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleTriggerCheckUpdate}
                  title="Kiểm tra bản cập nhật mới từ máy chủ"
                >
                  <RefreshCw size={13} /> Kiểm tra cập nhật
                </button>
              </div>
            </div>

            {publishMessage && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle size={16} /> {publishMessage}
              </div>
            )}

            <div style={{
              background: 'var(--bg-surface-elevated)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
                BẢN CẬP NHẬT ĐANG PHỤC VỤ MÁY CON (STUDENT CLIENTS)
              </div>
              
              {updateServerInfo?.latestInstaller ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f5f9' }}>
                      {updateServerInfo.latestInstaller.fileName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      Phiên bản: <strong style={{ color: '#34d399' }}>v{updateServerInfo.latestInstaller.version}</strong> • Dung lượng: {updateServerInfo.latestInstaller.fileSizeMB} MB
                    </div>
                  </div>
                  <span className="badge badge-ac">Sẵn Sàng Phát Hành</span>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Chưa có bản cập nhật nào trong thư mục máy chủ. Hãy chọn file .exe hoặc copy vào thư mục updates.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePublishUpdate}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <UploadCloud size={16} /> Chọn File .exe Để Phát Hành Cập Nhật
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleOpenUpdatesFolder}
              >
                <FolderOpen size={16} /> Mở Thư Mục Cập Nhật (Explorer)
              </button>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              <strong style={{ color: '#e2e8f0' }}>Quy trình cập nhật nhanh cho phòng máy:</strong><br />
              1. Tăng version trong <code>package.json</code> (ví dụ: <code>1.0.8</code> &rarr; <code>1.0.9</code>)<br />
              2. Chạy lệnh <code>npm run build:exe</code> để tạo bộ cài đặt mới trong thư mục <code>release/</code><br />
              3. Bấm nút <strong>"Chọn File .exe Để Phát Hành"</strong> ở trên &rarr; Hệ thống tự động đẩy thông báo sang toàn bộ máy học sinh để các máy tự cập nhật và khởi động lại!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
