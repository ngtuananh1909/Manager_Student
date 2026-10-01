import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { Problem } from '../../types';
import { useNetwork } from '../../context/NetworkContext';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle, ArrowRight, Eye, X } from 'lucide-react';

interface SuspectPair {
  id: string;
  student1: { id: string; name: string; submissionId: string; code: string; submittedAt: string };
  student2: { id: string; name: string; submissionId: string; code: string; submittedAt: string };
  similarity: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const PlagiarismView: React.FC = () => {
  const { serverUrl } = useNetwork();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(65);
  const [pairs, setPairs] = useState<SuspectPair[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [inspectPair, setInspectPair] = useState<SuspectPair | null>(null);

  useEffect(() => {
    fetchProblems();
  }, [serverUrl]);

  const fetchProblems = async () => {
    try {
      const res = await apiFetch(`${serverUrl}/api/problems?role=host`);
      if (res.ok) {
        const data: Problem[] = await res.json();
        setProblems(data);
        if (data.length > 0 && !selectedProblemId) {
          setSelectedProblemId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async () => {
    if (!selectedProblemId) return;
    setIsScanning(true);
    setInspectPair(null);

    try {
      const res = await apiFetch(`${serverUrl}/api/anticheat/scan/${selectedProblemId}?threshold=${threshold}`);
      if (res.ok) {
        const data = await res.json();
        setPairs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={24} style={{ color: 'var(--accent-rose)' }} />
            <h2 style={{ fontSize: '1.4rem' }}>Kiểm Tra Đạo Văn & Chống Gian Lận Code</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Phân tích cấu trúc token C++, phát hiện các cặp bài nộp tương đồng cao hoặc sao chép giữa các học sinh
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <div style={{ minWidth: '220px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              CHỌN BÀI TẬP ĐỂ QUÉT
            </label>
            <select 
              className="input-field"
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
            >
              {problems.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.title}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                NGƯỠNG TƯƠNG ĐỒNG (SIMILARITY)
              </label>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {threshold}%
              </span>
            </div>
            <input 
              type="range" 
              min="40" 
              max="95" 
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>
        </div>

        <button 
          className="btn btn-primary"
          onClick={handleScan}
          disabled={isScanning}
        >
          {isScanning ? <RefreshCw size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
          {isScanning ? 'Đang phân tích...' : 'Bắt Đầu Quét Đạo Văn'}
        </button>
      </div>

      {/* Results */}
      {pairs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
            Phát hiện {pairs.length} cặp bài nộp có dấu hiệu tương đồng cao trên {threshold}%:
          </div>

          {pairs.map((p) => (
            <div 
              key={p.id}
              className="glass-card"
              style={{ 
                borderLeft: `4px solid ${p.similarity >= 80 ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-mono)',
                  color: p.similarity >= 80 ? 'var(--accent-rose)' : 'var(--accent-amber)',
                  minWidth: '65px'
                }}>
                  {p.similarity}%
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--accent-cyan)' }}>{p.student1.name}</span>
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--accent-cyan)' }}>{p.student2.name}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Mức độ cảnh báo: <strong style={{ color: p.similarity >= 80 ? 'var(--accent-rose)' : 'var(--accent-amber)' }}>
                      {p.riskLevel === 'HIGH' ? 'RẤT CAO - Nghi vấn sao chép' : 'TRUNG BÌNH'}
                    </strong>
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setInspectPair(p)}
              >
                <Eye size={14} /> So Sánh Code 2 Bên
              </button>
            </div>
          ))}
        </div>
      ) : !isScanning && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <CheckCircle size={36} color="var(--accent-emerald)" style={{ marginBottom: '10px' }} />
          <div>Không phát hiện cặp bài nộp nào vượt ngưỡng tương đồng {threshold}%.</div>
          <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Chọn bài tập và nhấn "Bắt Đầu Quét Đạo Văn" để kiểm tra.</div>
        </div>
      )}

      {/* Side-by-Side Code Inspection Modal */}
      {inspectPair && (
        <div className="modal-overlay" onClick={() => setInspectPair(null)}>
          <div 
            className="glass-panel" 
            style={{ width: '95%', maxWidth: '1200px', height: '88vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem' }}>
                  Đối Chiếu Mã Nguồn: {inspectPair.student1.name} VS {inspectPair.student2.name}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-rose)', fontWeight: 700, marginTop: '2px' }}>
                  Độ tương đồng thuật toán & cấu trúc: {inspectPair.similarity}%
                </div>
              </div>

              <button className="btn btn-outline btn-sm" onClick={() => setInspectPair(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Split Code View */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '8px 12px', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', fontWeight: 600, fontSize: '0.85rem' }}>
                  Học sinh 1: {inspectPair.student1.name} (Nộp: {new Date(inspectPair.student1.submittedAt).toLocaleTimeString()})
                </div>
                <div style={{ flex: 1, background: '#1e1e1e', padding: '14px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)' }}>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {inspectPair.student1.code}
                  </pre>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '8px 12px', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', fontWeight: 600, fontSize: '0.85rem' }}>
                  Học sinh 2: {inspectPair.student2.name} (Nộp: {new Date(inspectPair.student2.submittedAt).toLocaleTimeString()})
                </div>
                <div style={{ flex: 1, background: '#1e1e1e', padding: '14px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)' }}>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                    {inspectPair.student2.code}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
