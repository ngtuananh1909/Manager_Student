import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: 'var(--bg-surface, #1e293b)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          margin: '16px',
          color: '#f8fafc',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f87171' }}>
                {this.props.fallbackTitle || 'Đã xảy ra sự cố hiển thị'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                Giao diện đã chặn được lỗi để tránh màn hình bị đen. Dữ liệu của bạn không bị mất.
              </p>
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: '#fca5a5',
            maxHeight: '120px',
            overflowY: 'auto',
            marginBottom: '16px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {this.state.error?.message || 'Lỗi không xác định'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#3b82f6',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> Thử lại / Khôi phục
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
