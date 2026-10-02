import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ArrowUpCircle, Loader2, Sparkles, ShieldAlert } from 'lucide-react';

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion?: string;
  clientVersion?: string;
  fileName?: string;
  fileSize?: number;
  fileSizeMB?: string;
  message?: string;
}

interface DownloadProgress {
  percent: number;
  downloadedMB: string;
  totalMB: string;
  version: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error' | 'up-to-date';

export const UpdateNotification: React.FC = () => {
  const { serverUrl, isConnected, socket } = useNetwork();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [autoInstallCountdown, setAutoInstallCountdown] = useState<number | null>(null);

  const electronAPI = (window as any).electronAPI;
  const timerRef = useRef<any>(null);

  // Get current version on mount
  useEffect(() => {
    if (electronAPI?.getAppVersion) {
      electronAPI.getAppVersion().then((v: string) => setCurrentVersion(v));
    }
  }, []);

  // Listen for download progress
  useEffect(() => {
    if (electronAPI?.onUpdateProgress) {
      const unsubscribe = electronAPI.onUpdateProgress((data: DownloadProgress) => {
        setProgress(data);
      });
      return typeof unsubscribe === 'function' ? unsubscribe : undefined;
    }
  }, []);

  // Check update logic
  const handleCheckUpdate = useCallback(async (isManual = false) => {
    if (!electronAPI?.checkForUpdate || !serverUrl) return;

    setStatus('checking');
    setErrorMessage('');

    try {
      const result = await electronAPI.checkForUpdate(serverUrl);

      if (!result.success) {
        if (isManual) {
          setErrorMessage(result.error || 'Không thể kiểm tra bản cập nhật.');
          setStatus('error');
        } else {
          setStatus('idle');
        }
        return;
      }

      setUpdateInfo(result);

      if (result.updateAvailable) {
        setStatus('available');
        setDismissed(false);
      } else {
        if (isManual) {
          setStatus('up-to-date');
          setDismissed(false);
          setTimeout(() => setStatus('idle'), 4000);
        } else {
          setStatus('idle');
        }
      }
    } catch (err: any) {
      if (isManual) {
        setErrorMessage(err.message || 'Lỗi kết nối máy chủ cập nhật.');
        setStatus('error');
      } else {
        setStatus('idle');
      }
    }
  }, [serverUrl]);

  // Fast auto-check when connected (1.5s after connection)
  useEffect(() => {
    if (!isConnected || !electronAPI?.checkForUpdate || !serverUrl) return;
    if (status !== 'idle') return;

    const timer = setTimeout(() => {
      handleCheckUpdate(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isConnected, serverUrl]);

  // Real-time update broadcast from Teacher Host via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const onBroadcastUpdate = (data: any) => {
      console.log('[Auto-Update] Received broadcast from server:', data);
      setDismissed(false);
      handleCheckUpdate(true);
    };
    socket.on('system:update_available', onBroadcastUpdate);
    return () => {
      socket.off('system:update_available', onBroadcastUpdate);
    };
  }, [socket, handleCheckUpdate]);

  // Listen for manual check trigger from Settings or Navbar
  useEffect(() => {
    const handleManualTrigger = () => {
      setDismissed(false);
      handleCheckUpdate(true);
    };
    window.addEventListener('check-app-update-now', handleManualTrigger);
    return () => {
      window.removeEventListener('check-app-update-now', handleManualTrigger);
    };
  }, [handleCheckUpdate]);

  const handleDownload = useCallback(async () => {
    if (!electronAPI?.downloadUpdate || !serverUrl) return;

    setStatus('downloading');
    setProgress({ percent: 0, downloadedMB: '0', totalMB: '0', version: '' });

    try {
      const result = await electronAPI.downloadUpdate(serverUrl);

      if (result.success) {
        setStatus('downloaded');
        // Auto-install countdown
        setAutoInstallCountdown(3);
      } else {
        setErrorMessage(result.error || 'Lỗi khi tải bản cập nhật.');
        setStatus('error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi không xác định.');
      setStatus('error');
    }
  }, [serverUrl]);

  const handleInstall = useCallback(async () => {
    if (!electronAPI?.installUpdate) return;

    setStatus('installing');

    try {
      const result = await electronAPI.installUpdate();
      if (!result.success) {
        setErrorMessage(result.error || 'Lỗi khi cài đặt.');
        setStatus('error');
      }
      // If success, the app quits and the installer runs + relaunches
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi cài đặt.');
      setStatus('error');
    }
  }, []);

  // Auto-install countdown effect
  useEffect(() => {
    if (status === 'downloaded' && autoInstallCountdown !== null) {
      if (autoInstallCountdown > 0) {
        timerRef.current = setTimeout(() => {
          setAutoInstallCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
      } else {
        handleInstall();
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, autoInstallCountdown, handleInstall]);

  const handleDismiss = () => {
    setDismissed(true);
    if (status === 'up-to-date') setStatus('idle');
  };

  // Don't render in non-Electron environments
  if (!electronAPI?.checkForUpdate) return null;

  // Don't render if dismissed or idle/checking
  if (dismissed && status !== 'downloading' && status !== 'downloaded' && status !== 'installing') return null;
  if (status === 'idle' || status === 'checking') return null;

  const isModal = status === 'available' || status === 'downloading' || status === 'downloaded' || status === 'installing';

  return (
    <div style={isModal ? styles.modalOverlay : styles.toastOverlay}>
      <div style={isModal ? styles.modalCard : styles.toastCard}>
        {/* Close / Skip button */}
        {status !== 'downloading' && status !== 'installing' && status !== 'downloaded' && (
          <button
            style={styles.closeBtn}
            onClick={handleDismiss}
            title="Đóng / Bỏ qua"
          >
            <X size={18} />
          </button>
        )}

        {/* 1. UPDATE AVAILABLE: PROMINENT MODAL */}
        {status === 'available' && updateInfo && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.pulseIconContainer}>
              <div style={styles.pulseRing} />
              <ArrowUpCircle size={56} style={{ color: '#818cf8', position: 'relative', zIndex: 2 }} />
            </div>

            <div style={styles.badgeTop}>
              <Sparkles size={13} style={{ color: '#a5b4fc' }} />
              <span>PHÁT HIỆN BẢN CẬP NHẬT MỚI TỪ PHÒNG MÁY</span>
            </div>

            <h2 style={styles.mainTitle}>Vui lòng cập nhật phần mềm</h2>
            
            <p style={styles.subTitle}>
              Máy chủ phòng máy đã phát hành phiên bản mới. Bạn cần cập nhật để đảm bảo đồng bộ đề thi, test case và tránh lỗi khi nộp bài.
            </p>

            <div style={styles.versionBox}>
              <div style={styles.versionItem}>
                <span style={styles.versionLabel}>Phiên bản đang dùng</span>
                <span style={styles.versionOldVal}>v{currentVersion || updateInfo.clientVersion || '1.0.0'}</span>
              </div>
              <div style={styles.versionArrow}>➔</div>
              <div style={styles.versionItem}>
                <span style={styles.versionLabel}>Bản mới nhất</span>
                <span style={styles.versionNewVal}>v{updateInfo.latestVersion}</span>
              </div>
            </div>

            {updateInfo.fileSizeMB && (
              <p style={styles.sizeInfo}>
                Dung lượng: <strong>{updateInfo.fileSizeMB} MB</strong> • Tải qua mạng LAN nội bộ (~2 giây)
              </p>
            )}

            <div style={styles.btnRow}>
              <button style={styles.bigPrimaryBtn} onClick={handleDownload}>
                <Download size={18} />
                Cập nhật ngay (Tự động)
              </button>
              <button style={styles.textBtn} onClick={handleDismiss}>
                Để sau (Bỏ qua lần này)
              </button>
            </div>
          </div>
        )}

        {/* 2. DOWNLOADING */}
        {status === 'downloading' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconWrapper}>
              <Loader2 size={52} style={{ color: '#818cf8', animation: 'spin 1s linear infinite' }} />
            </div>
            <h3 style={styles.mainTitle}>Đang tải bản cập nhật qua mạng LAN...</h3>
            <p style={styles.subTitle}>Vui lòng đợi giây lát, quá trình tải diễn ra rất nhanh</p>
            
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${progress?.percent || 0}%`
                  }}
                />
              </div>
              <div style={styles.progressStats}>
                <span>{progress?.percent || 0}%</span>
                <span>{progress?.downloadedMB || '0'} / {progress?.totalMB || '?'} MB</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. DOWNLOADED -> READY TO INSTALL */}
        {status === 'downloaded' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconWrapper}>
              <CheckCircle size={52} style={{ color: '#34d399' }} />
            </div>
            <h3 style={styles.mainTitle}>Tải thành công!</h3>
            <p style={styles.subTitle}>
              Ứng dụng sẽ tự động đóng lại, cài đặt bản mới và mở lại trong <strong>{autoInstallCountdown ?? 3}s</strong>...
            </p>
            <div style={styles.btnRow}>
              <button style={styles.bigSuccessBtn} onClick={handleInstall}>
                <RefreshCw size={18} />
                Cài đặt & Khởi động lại ngay ({autoInstallCountdown ?? 3}s)
              </button>
            </div>
          </div>
        )}

        {/* 4. INSTALLING */}
        {status === 'installing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconWrapper}>
              <Loader2 size={52} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />
            </div>
            <h3 style={styles.mainTitle}>Đang cài đặt bản mới...</h3>
            <p style={styles.subTitle}>Ứng dụng sẽ tự động mở lại ngay sau khi hoàn tất trong vài giây.</p>
          </div>
        )}

        {/* 5. ERROR */}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconWrapper}>
              <AlertTriangle size={52} style={{ color: '#f87171' }} />
            </div>
            <h3 style={{ ...styles.mainTitle, color: '#f87171' }}>Lỗi cập nhật</h3>
            <p style={styles.errorText}>{errorMessage}</p>
            <div style={styles.btnRow}>
              <button style={styles.bigPrimaryBtn} onClick={() => handleCheckUpdate(true)}>
                <RefreshCw size={16} /> Thử lại
              </button>
              <button style={styles.textBtn} onClick={handleDismiss}>
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* 6. UP TO DATE TOAST */}
        {status === 'up-to-date' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle size={28} style={{ color: '#34d399', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>Đã là phiên bản mới nhất</div>
              <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>Phiên bản hiện tại: v{currentVersion}</div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ========================================
// Inline Styles
// ========================================
const styles: Record<string, React.CSSProperties> = {
  // Center Modal Overlay
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    backdropFilter: 'blur(12px)',
    zIndex: 999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    background: 'linear-gradient(145deg, rgba(23, 28, 48, 0.98), rgba(15, 20, 36, 0.98))',
    border: '1px solid rgba(99, 102, 241, 0.35)',
    borderRadius: 20,
    padding: '36px 40px',
    maxWidth: 520,
    width: '100%',
    boxShadow: '0 25px 70px rgba(0, 0, 0, 0.7), 0 0 60px rgba(99, 102, 241, 0.2)',
    position: 'relative',
    animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  },

  // Corner Toast (Only for 'up-to-date')
  toastOverlay: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 99999,
    maxWidth: 380,
    width: '100%'
  },
  toastCard: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: 14,
    padding: '16px 20px',
    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
    position: 'relative'
  },

  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'none',
    borderRadius: 10,
    padding: '8px',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  pulseIconContainer: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0) 70%)',
    animation: 'pulseGlow 2.5s infinite ease-in-out'
  },
  iconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16
  },
  badgeTop: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    borderRadius: 99,
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    marginBottom: 14
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 10px 0',
    letterSpacing: '-0.02em'
  },
  subTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 1.6,
    margin: '0 0 20px 0'
  },
  versionBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: '14px 20px',
    marginBottom: 16
  },
  versionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4
  },
  versionLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  versionOldVal: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: 'rgba(255, 255, 255, 0.5)',
    textDecoration: 'line-through'
  },
  versionArrow: {
    fontSize: 20,
    color: '#818cf8',
    fontWeight: 700
  },
  versionNewVal: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#34d399'
  },
  sizeInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    margin: '0 0 24px 0'
  },
  btnRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12
  },
  bigPrimaryBtn: {
    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
    transition: 'all 0.2s'
  },
  bigSuccessBtn: {
    background: 'linear-gradient(135deg, #059669, #10b981)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.2s'
  },
  textBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '6px 12px',
    transition: 'all 0.2s'
  },
  progressContainer: {
    marginTop: 20
  },
  progressBar: {
    width: '100%',
    height: 10,
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #34d399)',
    borderRadius: 6,
    transition: 'width 0.2s ease'
  },
  progressStats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 10,
    fontFamily: 'monospace'
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    margin: '10px 0 20px 0',
    lineHeight: 1.5
  }
};
