import React, { useState, useMemo } from 'react';
import { DiffLine } from '../types';
import { ChevronDown, ChevronUp, GitCompare, EyeOff, Eye, Copy, Check, Filter } from 'lucide-react';

interface DiffViewerProps {
  diff?: DiffLine[];
  truncated?: boolean;
  userOutput?: string;
  expectedOutput?: string;
  showRawFallback?: boolean;
}

// Calculate character-level diff between two differing lines
function computeCharDiff(actual: string, expected: string) {
  let p = 0;
  while (p < actual.length && p < expected.length && actual[p] === expected[p]) {
    p++;
  }
  let as = actual.length - 1;
  let es = expected.length - 1;
  while (as >= p && es >= p && actual[as] === expected[es]) {
    as--;
    es--;
  }

  const prefix = actual.slice(0, p);
  const actualDiff = actual.slice(p, as + 1);
  const actualSuffix = actual.slice(as + 1);

  const expectedDiff = expected.slice(p, es + 1);
  const expectedSuffix = expected.slice(es + 1);

  return {
    actualParts: [
      { text: prefix, diff: false },
      { text: actualDiff, diff: true },
      { text: actualSuffix, diff: false },
    ].filter(x => x.text.length > 0),
    expectedParts: [
      { text: prefix, diff: false },
      { text: expectedDiff, diff: true },
      { text: expectedSuffix, diff: false },
    ].filter(x => x.text.length > 0)
  };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ 
  diff = [], 
  truncated = false, 
  userOutput, 
  expectedOutput, 
  showRawFallback = true 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const [copiedType, setCopiedType] = useState<'actual' | 'expected' | null>(null);

  const copyText = (text: string, type: 'actual' | 'expected') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  };

  // Find index of first divergent line
  const firstDiffIndex = useMemo(() => {
    return diff.findIndex(l => l.type !== 'equal');
  }, [diff]);

  // Total count of diverging lines
  const diffCount = useMemo(() => {
    return diff.filter(l => l.type !== 'equal').length;
  }, [diff]);

  // Determine lines to display
  const displayedLines = useMemo(() => {
    if (!diff || diff.length === 0) return [];
    
    let filtered = diff;
    if (onlyDiffs) {
      filtered = diff.filter(l => l.type !== 'equal');
    }

    if (expanded) {
      return filtered;
    }

    // Default compact view: If test case is long, show first few differing lines
    if (firstDiffIndex === -1) {
      return filtered.slice(0, 6);
    }

    // Window around first diff: 1 context before, then up to 5 lines
    const startIdx = Math.max(0, firstDiffIndex - 1);
    const endIdx = Math.min(filtered.length, startIdx + 6);
    return filtered.slice(startIdx, endIdx);
  }, [diff, expanded, onlyDiffs, firstDiffIndex]);

  const hasMoreLines = diff.length > displayedLines.length || truncated;

  // Fallback when diff array is empty but raw outputs exist
  if (!diff || diff.length === 0) {
    if (showRawFallback && (userOutput !== undefined || expectedOutput !== undefined)) {
      return (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f87171' }}>ĐẦU RA CỦA BẠN:</span>
                {userOutput && (
                  <button onClick={() => copyText(userOutput, 'actual')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}>
                    {copiedType === 'actual' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedType === 'actual' ? 'Đã chép' : 'Chép'}
                  </button>
                )}
              </div>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fca5a5', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
                {userOutput || '(trống)'}
              </pre>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#34d399' }}>FILE .OUT MONG ĐỢI:</span>
                {expectedOutput && (
                  <button onClick={() => copyText(expectedOutput, 'expected')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}>
                    {copiedType === 'expected' ? <Check size={11} /> : <Copy size={11} />}
                    {copiedType === 'expected' ? 'Đã chép' : 'Chép'}
                  </button>
                )}
              </div>
              <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#6ee7b7', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
                {expectedOutput || '(trống)'}
              </pre>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ marginTop: '12px', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Diff Controls Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '6px 10px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
        fontSize: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: 'var(--accent-amber)' }}>
            <GitCompare size={14} />
            <span>SO SÁNH KẾT QUẢ (DIFF)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f87171' }}></span>
              <strong style={{ color: '#f87171' }}>+ Dòng thừa / Sai</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#34d399' }}></span>
              <strong style={{ color: '#34d399' }}>- Dòng thiếu (.out)</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fbbf24' }}></span>
              <strong style={{ color: '#fbbf24' }}>≠ Lệch giá trị</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Toggle filter only diffs */}
          <button
            onClick={() => setOnlyDiffs(v => !v)}
            title="Lọc chỉ hiển thị các dòng bị lệch"
            style={{ 
              background: onlyDiffs ? 'rgba(245,158,11,0.2)' : 'none', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: '4px', 
              padding: '2px 8px', 
              cursor: 'pointer', 
              fontSize: '0.7rem', 
              color: onlyDiffs ? 'var(--accent-amber)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Filter size={11} />
            {onlyDiffs ? 'Tất cả dòng' : 'Chỉ dòng lệch'}
          </button>

          {/* Toggle Raw output */}
          <button 
            onClick={() => setShowRaw(v => !v)} 
            style={{ 
              background: showRaw ? 'var(--bg-app)' : 'none', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: '4px', 
              padding: '2px 8px', 
              cursor: 'pointer', 
              fontSize: '0.7rem', 
              color: 'var(--text-secondary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px' 
            }}
          >
            {showRaw ? <EyeOff size={11} /> : <Eye size={11} />}
            {showRaw ? 'Xem Diff' : 'Xem Raw song song'}
          </button>
        </div>
      </div>

      {showRaw ? (
        /* Raw Side-by-Side Comparison */
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '8px', 
          background: 'var(--bg-app)', 
          border: '1px solid var(--border-subtle)', 
          padding: '10px',
          borderRadius: '0 0 6px 6px'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f87171' }}>ĐẦU RA CỦA BẠN (ACTUAL):</span>
              {userOutput && (
                <button onClick={() => copyText(userOutput, 'actual')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem' }}>
                  {copiedType === 'actual' ? <Check size={11} /> : <Copy size={11} />}
                  {copiedType === 'actual' ? 'Đã sao chép' : 'Sao chép'}
                </button>
              )}
            </div>
            <pre style={{ 
              background: 'rgba(244,63,94,0.06)', 
              border: '1px solid rgba(244,63,94,0.25)', 
              borderRadius: '6px', 
              padding: '8px 10px', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.78rem', 
              color: '#fca5a5', 
              margin: 0, 
              whiteSpace: 'pre-wrap', 
              maxHeight: '180px', 
              overflowY: 'auto' 
            }}>
              {userOutput ?? '(trống)'}
            </pre>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399' }}>FILE .OUT MONG ĐỢI (EXPECTED):</span>
              {expectedOutput && (
                <button onClick={() => copyText(expectedOutput, 'expected')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem' }}>
                  {copiedType === 'expected' ? <Check size={11} /> : <Copy size={11} />}
                  {copiedType === 'expected' ? 'Đã sao chép' : 'Sao chép'}
                </button>
              )}
            </div>
            <pre style={{ 
              background: 'rgba(16,185,129,0.06)', 
              border: '1px solid rgba(16,185,129,0.25)', 
              borderRadius: '6px', 
              padding: '8px 10px', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.78rem', 
              color: '#6ee7b7', 
              margin: 0, 
              whiteSpace: 'pre-wrap', 
              maxHeight: '180px', 
              overflowY: 'auto' 
            }}>
              {expectedOutput ?? '(kỳ vọng từ bộ test)'}
            </pre>
          </div>
        </div>
      ) : (
        /* Git-style Unified Diff with Intra-line Character Highlight */
        <div style={{ 
          background: 'var(--bg-app)', 
          border: '1px solid var(--border-subtle)', 
          borderRadius: '0 0 6px 6px', 
          overflow: 'hidden', 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.78rem' 
        }}>
          {displayedLines.map((line, idx) => {
            if (line.type === 'modified') {
              // Intra-line character difference
              const charDiff = computeCharDiff(line.content || '', line.expectedContent || '');
              return (
                <div key={idx} style={{ borderLeft: '3px solid #fbbf24', background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '4px 8px' }}>
                  {/* Expected line (-) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '20px' }}>
                    <span style={{ width: '14px', flexShrink: 0, fontWeight: 800, color: '#34d399', userSelect: 'none' }}>-</span>
                    <span style={{ width: '32px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'right', userSelect: 'none' }}>L{line.lineNo}</span>
                    <span style={{ flex: 1, color: '#a7f3d0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {charDiff.expectedParts.map((part, pIdx) => (
                        <span key={pIdx} style={{ 
                          background: part.diff ? 'rgba(16,185,129,0.35)' : 'transparent',
                          color: part.diff ? '#6ee7b7' : '#a7f3d0',
                          borderRadius: part.diff ? '2px' : 0,
                          fontWeight: part.diff ? 700 : 400,
                          textDecoration: part.diff ? 'underline' : 'none'
                        }}>
                          {part.text}
                        </span>
                      ))}
                    </span>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.2)', color: '#34d399', flexShrink: 0 }}>
                      Kỳ vọng (.out)
                    </span>
                  </div>

                  {/* Student actual line (+) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '20px', marginTop: '2px' }}>
                    <span style={{ width: '14px', flexShrink: 0, fontWeight: 800, color: '#f87171', userSelect: 'none' }}>+</span>
                    <span style={{ width: '32px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'right', userSelect: 'none' }}>L{line.lineNo}</span>
                    <span style={{ flex: 1, color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {charDiff.actualParts.map((part, pIdx) => (
                        <span key={pIdx} style={{ 
                          background: part.diff ? 'rgba(244,63,94,0.35)' : 'transparent',
                          color: part.diff ? '#fca5a5' : '#f87171',
                          borderRadius: part.diff ? '2px' : 0,
                          fontWeight: part.diff ? 700 : 400
                        }}>
                          {part.text}
                        </span>
                      ))}
                    </span>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(244,63,94,0.2)', color: '#f87171', flexShrink: 0 }}>
                      Bạn in ra
                    </span>
                  </div>
                </div>
              );
            }

            const isAdded = line.type === 'added';
            const isRemoved = line.type === 'removed';
            const isEqual = line.type === 'equal';

            const bg = isAdded ? 'rgba(244,63,94,0.1)' : isRemoved ? 'rgba(16,185,129,0.1)' : 'transparent';
            const borderCol = isAdded ? '#f87171' : isRemoved ? '#34d399' : 'transparent';
            const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';
            const prefixCol = isAdded ? '#f87171' : isRemoved ? '#34d399' : 'var(--text-muted)';
            const textCol = isAdded ? '#fca5a5' : isRemoved ? '#6ee7b7' : 'var(--text-secondary)';

            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: bg, 
                  borderLeft: `3px solid ${borderCol}`, 
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  padding: '2px 8px', 
                  minHeight: '22px', 
                  gap: '6px' 
                }}
              >
                <span style={{ width: '14px', flexShrink: 0, fontWeight: 800, color: prefixCol, userSelect: 'none' }}>{prefix}</span>
                <span style={{ width: '32px', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'right', userSelect: 'none' }}>L{line.lineNo}</span>
                <span style={{ flex: 1, color: textCol, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content || '\u00a0'}</span>
                
                {isAdded && (
                  <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(244,63,94,0.2)', color: '#f87171', flexShrink: 0 }}>
                    Thừa dòng
                  </span>
                )}
                {isRemoved && (
                  <span style={{ fontSize: '0.64rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.2)', color: '#34d399', flexShrink: 0 }}>
                    Thiếu dòng
                  </span>
                )}
              </div>
            );
          })}

          {/* Footer toggle for long test cases */}
          {hasMoreLines && (
            <div style={{ 
              borderTop: '1px solid var(--border-subtle)', 
              padding: '8px 12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: 'var(--bg-surface-elevated)'
            }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {expanded 
                  ? `Đang hiển thị toàn bộ ${displayedLines.length} dòng diff (${diffCount} dòng khác biệt)` 
                  : `Đang hiển thị ${displayedLines.length} dòng đầu tiên (còn ${diff.length - displayedLines.length} dòng khác)`}
              </span>

              <button 
                onClick={() => setExpanded(v => !v)} 
                style={{ 
                  background: 'none', 
                  border: '1px solid var(--primary)', 
                  borderRadius: '4px', 
                  padding: '3px 10px', 
                  cursor: 'pointer', 
                  fontSize: '0.72rem', 
                  color: 'var(--primary-light)', 
                  fontWeight: 600,
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px' 
                }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? 'Thu gọn' : `Xem toàn bộ diff (${diff.length} dòng)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
