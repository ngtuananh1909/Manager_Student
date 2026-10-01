import React, { useState, useEffect } from 'react';
import { useNetwork, NetworkMode } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import { 
  Wifi, 
  Globe, 
  Server, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  Zap, 
  Save, 
  ShieldCheck 
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LANDiscoveryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    networkMode, 
    setNetworkMode, 
    lanUrl, 
    setLanUrl, 
    internetUrl, 
    setInternetUrl, 
    serverUrl, 
    isConnected, 
    latency, 
    discoveredServers, 
    isScanning, 
    scanForServers, 
    testConnection 
  } = useNetwork();

  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<NetworkMode>(networkMode);
  const [tempLanUrl, setTempLanUrl] = useState(lanUrl);
  const [tempInternetUrl, setTempInternetUrl] = useState(internetUrl);
  const [testResult, setTestResult] = useState<{ testing: boolean; success?: boolean; latency?: number; error?: string }>({ testing: false });
  const [hostIps, setHostIps] = useState<Array<{ name: string; address: string }>>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(networkMode);
      setTempLanUrl(lanUrl);
      setTempInternetUrl(internetUrl);
      scanForServers();
      fetchDiagnostics();
    }
  }, [isOpen]);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/diagnostics`);
      if (res.ok) {
        const data = await res.json();
        if (data.localIps) setHostIps(data.localIps);
      }
    } catch (e) {}
  };

  if (!isOpen) return null;

  const handleTestAndSave = async (mode: NetworkMode, url: string) => {
    setTestResult({ testing: true });
    const result = await testConnection(url);

    if (result.success) {
      if (mode === 'lan') setLanUrl(url);
      else setInternetUrl(url);
      setNetworkMode(mode);
      setTestResult({ testing: false, success: true, latency: result.latency });
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setTestResult({ testing: false, success: false, error: result.error });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-panel" 
        style={{ width: '100%', maxWidth: '620px', padding: '26px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Cấu Hình Kết Nối Mạng</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Chuyển đổi linh hoạt giữa Mạng LAN phòng máy và Internet từ xa
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Đóng</button>
        </div>

        {/* Current Active Mode Status Card */}
        <div style={{ 
          background: isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isConnected ? (
              <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
            ) : (
              <AlertCircle size={18} style={{ color: 'var(--accent-rose)' }} />
            )}
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                {isConnected ? 'Đang kết nối tới máy chủ' : 'Chưa kết nối được máy chủ'} ({networkMode.toUpperCase()} Mode)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {serverUrl}
              </div>
            </div>
          </div>
          {latency !== null && (
            <div style={{ 
              fontSize: '0.8rem', 
              padding: '4px 8px', 
              borderRadius: 'var(--radius-sm)', 
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-emerald)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
              {latency}ms
            </div>
          )}
        </div>

        {/* Mode Switch Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button 
            className={`btn ${activeTab === 'lan' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => { setActiveTab('lan'); setTestResult({ testing: false }); }}
          >
            <Wifi size={16} /> 1. Chế Độ LAN (Tại Trường)
          </button>
          <button 
            className={`btn ${activeTab === 'internet' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => { setActiveTab('internet'); setTestResult({ testing: false }); }}
          >
            <Globe size={16} /> 2. Chế Độ Internet (Tại Nhà)
          </button>
        </div>

        {/* Tab 1: LAN Mode Configuration */}
        {activeTab === 'lan' && (
          <div>
            {role === 'host' && hostIps.length > 0 && (
              <div style={{ 
                background: 'rgba(99, 102, 241, 0.08)', 
                border: '1px solid rgba(99, 102, 241, 0.25)', 
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-light)', marginBottom: '6px' }}>
                  Địa chỉ IP máy Giáo Viên để học sinh kết nối trong LAN:
                </div>
                {hostIps.map((ip, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <code style={{ color: 'var(--accent-cyan)' }}>http://{ip.address}:4000</code>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => copyToClipboard(`http://${ip.address}:4000`)}>
                      {copied ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Auto Discovered Servers in LAN */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>MÁY CHỦ QUÉT ĐƯỢC TỰ ĐỘNG</span>
                <button className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={scanForServers} disabled={isScanning}>
                  <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} /> Quét lại
                </button>
              </div>

              {discoveredServers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {discoveredServers.map((srv, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-elevated)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{srv.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{srv.ip}:{srv.port}</div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => handleTestAndSave('lan', `http://${srv.ip}:${srv.port}`)}>
                        <Zap size={13} /> Áp Dụng
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  Chưa thấy máy chủ qua UDP Beacon. Nhập IP bên dưới để áp dụng trực tiếp.
                </div>
              )}
            </div>

            {/* Manual LAN URL */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                ĐỊA CHỈ IP LAN MÁY HOST
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="http://192.168.1.6:4000 hoặc http://localhost:4000"
                  value={tempLanUrl}
                  onChange={(e) => setTempLanUrl(e.target.value)}
                />
                <button 
                  className="btn btn-primary"
                  onClick={() => handleTestAndSave('lan', tempLanUrl)}
                  disabled={testResult.testing}
                >
                  {testResult.testing ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu & Kết Nối
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Internet DDNS / Port Forwarding Mode */}
        {activeTab === 'internet' && (
          <div>
            <div style={{ 
              background: 'rgba(6, 182, 212, 0.08)', 
              border: '1px solid rgba(6, 182, 212, 0.25)', 
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              <strong style={{ color: 'var(--accent-cyan)' }}>Dành cho học sinh làm bài tập từ nhà:</strong>
              <br />
              Nhập tên miền Dynamic DNS qua giao thức <strong>HTTPS</strong> (ví dụ: <code>https://truong-abc.duckdns.org</code> hoặc link <code>https://...trycloudflare.com</code>).
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                TÊN MIỀN DDNS / HTTPS CLOUD
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="https://truong-abc.duckdns.org"
                  value={tempInternetUrl}
                  onChange={(e) => setTempInternetUrl(e.target.value)}
                />
                <button 
                  className="btn btn-primary"
                  onClick={() => handleTestAndSave('internet', tempInternetUrl)}
                  disabled={testResult.testing}
                >
                  {testResult.testing ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu & Kết Nối
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Result Message */}
        {testResult.success && (
          <div style={{ marginTop: '14px', color: 'var(--accent-emerald)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={15} /> Kết nối thành công ({testResult.latency}ms)! Đã lưu cấu hình.
          </div>
        )}
        {testResult.error && (
          <div style={{ marginTop: '14px', color: 'var(--accent-rose)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={15} /> Không thể kết nối: {testResult.error}
          </div>
        )}

        {/* Device Role Status & Switch */}
        <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Vai trò máy tính: <strong style={{ color: 'var(--text-main)' }}>
              {localStorage.getItem('schooljudge_device_role') === 'host' ? '👨‍🏫 Máy Chủ Giáo Viên' : '🎓 Máy Trạm Học Sinh'}
            </strong>
          </div>
          <button 
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.74rem', padding: '3px 8px' }}
            onClick={() => {
              if (confirm('Bạn có muốn đổi vai trò máy tính này (Máy Chủ / Máy Học Sinh)? Ứng dụng sẽ tải lại.')) {
                localStorage.removeItem('schooljudge_device_role');
                if ((window as any).electronAPI?.setAppRole) {
                  (window as any).electronAPI.setAppRole(null);
                }
                window.location.reload();
              }
            }}
          >
            Đổi Vai Trò Máy Này
          </button>
        </div>
      </div>
    </div>
  );
};
