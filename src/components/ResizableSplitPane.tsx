import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number;
  controlledPercent?: number | null;
  onPercentChange?: (percent: number) => void;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ResizableSplitPane: React.FC<ResizableSplitPaneProps> = ({
  left,
  right,
  initialLeftPercent = 45,
  controlledPercent = null,
  onPercentChange,
  minLeftPercent = 20,
  maxLeftPercent = 80,
  storageKey = 'schooljudge_exam_split_ratio',
  className = '',
  style = {}
}) => {
  // Load saved preference from localStorage
  const [leftPercent, setLeftPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= minLeftPercent && parsed <= maxLeftPercent) {
          return parsed;
        }
      }
    } catch (e) {}
    return initialLeftPercent;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Save to localStorage when changed
  const updatePercent = useCallback((newPercent: number) => {
    const clamped = Math.max(minLeftPercent, Math.min(maxLeftPercent, Math.round(newPercent * 10) / 10));
    setLeftPercent(clamped);
    if (onPercentChange) onPercentChange(clamped);
    try {
      localStorage.setItem(storageKey, String(clamped));
    } catch (e) {}
  }, [minLeftPercent, maxLeftPercent, storageKey, onPercentChange]);

  // Synchronize if controlledPercent changes from external preset buttons
  useEffect(() => {
    if (typeof controlledPercent === 'number' && !isNaN(controlledPercent) && controlledPercent > 0) {
      updatePercent(controlledPercent);
    }
  }, [controlledPercent, updatePercent]);

  // Double click resets to 50/50
  const handleDoubleClick = () => {
    updatePercent(50);
  };

  // Keyboard navigation on separator
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      updatePercent(leftPercent - 3);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      updatePercent(leftPercent + 3);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updatePercent(50);
    }
  };

  // Pointer drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const currentX = moveEvent.clientX - rect.left;
      const newPercent = (currentX / rect.width) * 100;
      updatePercent(newPercent);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div 
      ref={containerRef}
      className={`resizable-split-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        userSelect: isDragging ? 'none' : 'auto',
        ...style
      }}
    >
      {/* Invisible overlay while dragging to prevent iframes/editor from swallowing pointer events */}
      {isDragging && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            cursor: 'col-resize',
            userSelect: 'none'
          }} 
        />
      )}

      {/* LEFT PANE (ĐỀ BÀI) */}
      <div 
        style={{
          width: `${leftPercent}%`,
          minWidth: '260px',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {left}
      </div>

      {/* DRAGGABLE DIVIDER (THANH CHIA KÉO NGANG) */}
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftPercent)}
        aria-valuemin={minLeftPercent}
        aria-valuemax={maxLeftPercent}
        aria-label="Điều chỉnh kích thước khu vực đề và code"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        title="Kéo sang trái/phải để chỉnh tỉ lệ (Nhấp đúp chuột để về 50/50)"
        style={{
          width: '10px',
          height: '100%',
          cursor: 'col-resize',
          background: isDragging 
            ? 'var(--primary)' 
            : 'var(--border-subtle)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          transition: isDragging ? 'none' : 'background 0.2s ease',
          outline: 'none'
        }}
      >
        {/* Grip handle visual pill */}
        <div 
          style={{
            width: '4px',
            height: '36px',
            borderRadius: '4px',
            background: isDragging ? '#ffffff' : 'var(--text-muted)',
            opacity: isDragging ? 1 : 0.6,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: 'none'
          }}
        />

        {/* Hover / Active tooltip showing ratio */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-surface-elevated)',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--border-medium)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 100
          }}>
            {Math.round(leftPercent)}% / {100 - Math.round(leftPercent)}%
          </div>
        )}
      </div>

      {/* RIGHT PANE (CODE IDE & CONSOLE) */}
      <div 
        style={{
          width: `${100 - leftPercent}%`,
          minWidth: '280px',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {right}
      </div>
    </div>
  );
};
