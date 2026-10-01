import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2,
  Check, 
  Copy,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Eye,
  Sliders,
  MoveHorizontal
} from 'lucide-react';

interface StatementViewerProps {
  url?: string;
  src?: string;
  fileName?: string;
  title?: string;
  serverUrl?: string;
  style?: React.CSSProperties;
  height?: string;
}

export const StatementViewer: React.FC<StatementViewerProps> = ({
  url = '',
  src = '',
  fileName = '',
  title = '',
  serverUrl = '',
  style = {},
  height = '560px'
}) => {
  const targetUrl = url || src || '';
  const fullUrl = !targetUrl 
    ? '' 
    : (targetUrl.startsWith('http') || targetUrl.startsWith('data:') || targetUrl.startsWith('blob:'))
      ? targetUrl 
      : (serverUrl ? `${serverUrl}${targetUrl}` : targetUrl);

  const lowerName = (fileName || targetUrl || '').toLowerCase();

  // Detect format
  const isPdf = lowerName.endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(lowerName);
  const isText = /\.(txt|md)$/i.test(lowerName);
  const isWord = /\.(docx?)$/i.test(lowerName);

  // Text file content state
  const [textContent, setTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState<boolean>(false);
  const [textError, setTextError] = useState<string>('');

  // Word docx HTML content state
  const [wordHtml, setWordHtml] = useState<string>('');
  const [loadingWord, setLoadingWord] = useState<boolean>(false);
  const [wordError, setWordError] = useState<string>('');

  // Zoom & View state: 70% -> 200%, Fit Width, Fit Page, Fullscreen
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [fitMode, setFitMode] = useState<'normal' | 'fit-width' | 'fit-page'>('normal');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fullUrl) return;

    if (isText) {
      setLoadingText(true);
      setTextError('');
      if (fullUrl.startsWith('data:')) {
        try {
          const b64 = fullUrl.split(';base64,')[1];
          const decoded = decodeURIComponent(escape(atob(b64)));
          setTextContent(decoded);
          setLoadingText(false);
        } catch (e: any) {
          setTextError('Không thể đọc file văn bản: ' + e.message);
          setLoadingText(false);
        }
      } else {
        fetch(fullUrl)
          .then(res => {
            if (!res.ok) throw new Error('Không thể tải file văn bản');
            return res.text();
          })
          .then(txt => setTextContent(txt))
          .catch(err => setTextError(err.message))
          .finally(() => setLoadingText(false));
      }
    } else if (isWord) {
      setLoadingWord(true);
      setWordError('');

      // If pending base64 from file picker
      if (fullUrl.startsWith('data:')) {
        fetch(`${serverUrl || ''}/api/parse-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, fileData: fullUrl })
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.type === 'html' && data.content) {
              setWordHtml(data.content);
            } else if (data && data.error) {
              setWordError(data.error);
            } else {
              setWordError('Không thể chuyển đổi nội dung file DOCX');
            }
          })
          .catch(err => setWordError(err.message))
          .finally(() => setLoadingWord(false));
      } else {
        // From existing problem or contest endpoint
        const contentApiUrl = fullUrl.replace(/\/pdf$/, '/statement-content');
        fetch(contentApiUrl)
          .then(res => res.json())
          .then(data => {
            if (data && data.type === 'html' && data.content) {
              setWordHtml(data.content);
            } else if (data && data.type === 'text' && data.content) {
              setTextContent(data.content);
            } else if (data && data.error) {
              setWordError(data.error);
            }
          })
          .catch(err => setWordError(err.message))
          .finally(() => setLoadingWord(false));
      }
    }
  }, [fullUrl, isText, isWord, fileName, serverUrl]);

  const handleCopyText = () => {
    const textToCopy = textContent || (wordHtml ? wordHtml.replace(/<[^>]+>/g, ' ') : '');
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleZoomIn = () => {
    setFitMode('normal');
    setZoomLevel(prev => Math.min(200, prev + 10));
  };

  const handleZoomOut = () => {
    setFitMode('normal');
    setZoomLevel(prev => Math.max(60, prev - 10));
  };

  const handleResetZoom = () => {
    setFitMode('normal');
    setZoomLevel(100);
  };

  const handleFitWidth = () => {
    setFitMode(prev => prev === 'fit-width' ? 'normal' : 'fit-width');
    setZoomLevel(100);
  };

  const handleFitPage = () => {
    setFitMode(prev => prev === 'fit-page' ? 'normal' : 'fit-page');
    setZoomLevel(90);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  if (!fullUrl) {
    return (
      <div style={{ 
        padding: '24px', 
        textAlign: 'center', 
        color: '#64748b', 
        background: '#f8fafc', 
        borderRadius: '8px', 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        border: '1px dashed #cbd5e1',
        ...style 
      }}>
        Chưa có file đề bài hoặc đường dẫn file không hợp lệ
      </div>
    );
  }

  return (
    <div 
      ref={viewerContainerRef}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        borderRadius: isFullscreen ? '0' : '8px', 
        overflow: 'hidden', 
        border: isFullscreen ? 'none' : '1px solid #cbd5e1', 
        background: '#f1f5f9', // Clean Word desktop canvas gray
        height: isFullscreen ? '100vh' : height,
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        zIndex: isFullscreen ? 99999 : 'auto',
        boxShadow: isFullscreen ? 'none' : '0 4px 16px rgba(0,0,0,0.06)',
        ...style 
      }}
    >
      {/* 1. TOP TITLE & CONTROLS TOOLBAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.82rem',
        flexShrink: 0,
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="#2563eb" />
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
            📄 XEM ĐỀ: {fileName || title || 'Tài Liệu Đề Bài'}
          </span>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '4px',
            background: isWord ? '#e0f2fe' : isPdf ? '#fee2e2' : '#f0fdf4',
            color: isWord ? '#0284c7' : isPdf ? '#dc2626' : '#16a34a'
          }}>
            {isWord ? 'WORD (.DOCX)' : isPdf ? 'PDF' : isImage ? 'ẢNH' : 'VĂN BẢN'}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom controls: 🔍 − 100% + */}
          {/* Zoom controls: 🔍 − 100% + */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '2px', 
            background: '#f1f5f9', 
            padding: '2px 6px', 
            borderRadius: '6px', 
            border: '1px solid #cbd5e1' 
          }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '4px' }}>🔍</span>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 60}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
              title="Thu nhỏ"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: '0.76rem', fontWeight: 600, color: '#0f172a', minWidth: '42px', textAlign: 'center' }}
              title="Đặt lại 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}
              title="Phóng to"
            >
              +
            </button>
          </div>

          {/* Fit Mode Buttons */}
          <button
            type="button"
            onClick={handleFitWidth}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              background: fitMode === 'fit-width' ? '#e0f2fe' : '#ffffff',
              color: fitMode === 'fit-width' ? '#0284c7' : '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Căn vừa chiều rộng màn hình"
          >
            <MoveHorizontal size={13} /> Fit Width
          </button>

          <button
            type="button"
            onClick={handleFitPage}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              background: fitMode === 'fit-page' ? '#e0f2fe' : '#ffffff',
              color: fitMode === 'fit-page' ? '#0284c7' : '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Căn vừa toàn bộ trang"
          >
            <Maximize2 size={13} /> Fit Page
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              background: isFullscreen ? '#fef3c7' : '#ffffff',
              color: isFullscreen ? '#b45309' : '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Xem toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          </button>

          {/* Copy button */}
          {((isText && textContent) || (isWord && wordHtml)) && (
            <button
              type="button"
              onClick={handleCopyText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isCopied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
              {isCopied ? 'Đã chép' : 'Chép đề'}
            </button>
          )}

          {/* Download button */}
          <a
            href={fullUrl}
            download={fileName || 'de_bai'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            title="Tải file về máy"
          >
            <Download size={13} /> Tải Về
          </a>

          {!fullUrl.startsWith('data:') && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              title="Mở trong tab mới"
            >
              <ExternalLink size={13} /> Tab Mới
            </a>
          )}
        </div>
      </div>

      {/* 2. VIEWER CANVAS: NỀN TRẮNG CHUẨN WORD / DOCUMENT PREVIEW */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'auto', 
        position: 'relative', 
        background: '#e2e8f0', // Canvas background like MS Word
        padding: '24px 16px'
      }}>
        {/* WORD DOCUMENT PREVIEW (.DOCX, .DOC) */}
        {isWord && (
          loadingWord ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#0284c7' }} />
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Đang phân tích cấu trúc file Word (.docx)...</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Chuyển đổi sang giao diện tài liệu văn bản chuẩn</div>
            </div>
          ) : wordError ? (
            <div style={{ 
              maxWidth: '680px', 
              margin: '30px auto', 
              background: '#ffffff', 
              padding: '28px', 
              borderRadius: '8px', 
              border: '1px solid #fca5a5', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              textAlign: 'center'
            }}>
              <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ color: '#b91c1c', marginBottom: '8px', fontSize: '1rem' }}>⚠ Không thể đọc file đề Word</h4>
              <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.6, marginBottom: '16px' }}>
                {wordError}
              </p>
              <a 
                href={fullUrl} 
                download={fileName || 'de_bai.docx'}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <Download size={14} /> Tải file về mở bằng Microsoft Word
              </a>
            </div>
          ) : wordHtml ? (
            /* Document Page Sheet: White Background, shadow, padding, word typography */
            <div style={{
              transform: fitMode === 'fit-width' ? 'none' : `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
              width: '100%',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <div 
                className="word-document-sheet"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  width: fitMode === 'fit-width' ? '100%' : '100%',
                  maxWidth: fitMode === 'fit-width' ? '1140px' : fitMode === 'fit-page' ? '760px' : '860px',
                  minHeight: '800px',
                  margin: '0 auto',
                  padding: fitMode === 'fit-width' ? '40px 48px' : '48px 56px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0,0,0,0.06)',
                  borderRadius: '4px',
                  fontFamily: "'Segoe UI', 'Calibri', 'Times New Roman', Times, serif, sans-serif",
                  fontSize: '1rem',
                  lineHeight: 1.75
                }}
              >
                <style>{`
                  .word-document-sheet h1 { font-size: 1.55rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                  .word-document-sheet h2 { font-size: 1.28rem; font-weight: 700; margin-top: 20px; margin-bottom: 12px; color: #1e293b; }
                  .word-document-sheet h3 { font-size: 1.1rem; font-weight: 700; margin-top: 16px; margin-bottom: 8px; color: #334155; }
                  .word-document-sheet p { margin-bottom: 12px; color: #1e293b; }
                  .word-document-sheet table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.92rem; }
                  .word-document-sheet th, .word-document-sheet td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                  .word-document-sheet th { background: #f8fafc; font-weight: 700; }
                  .word-document-sheet pre, .word-document-sheet code { font-family: 'JetBrains Mono', Consolas, monospace; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-size: 0.88rem; color: #0f172a; }
                  .word-document-sheet pre { padding: 12px; overflow-x: auto; line-height: 1.5; border: 1px solid #e2e8f0; margin: 12px 0; }
                  .word-document-sheet ul, .word-document-sheet ol { padding-left: 24px; margin-bottom: 14px; }
                  .word-document-sheet li { margin-bottom: 6px; }
                  .word-document-sheet img { max-width: 100%; height: auto; border-radius: 4px; margin: 10px 0; }
                `}</style>
                <div dangerouslySetInnerHTML={{ __html: wordHtml }} />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              File Word chưa có nội dung văn bản.
            </div>
          )
        )}

        {/* PDF DOCUMENT PREVIEW */}
        {isPdf && (
          <div style={{ 
            height: '100%', 
            minHeight: isFullscreen ? 'calc(100vh - 60px)' : '540px', 
            background: '#ffffff', 
            borderRadius: '4px', 
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: fitMode === 'fit-width' ? '100%' : fitMode === 'fit-page' ? '760px' : '960px',
            margin: '0 auto',
            transition: 'max-width 0.2s ease'
          }}>
            <iframe 
              src={`${fullUrl}#toolbar=1&navpanes=0&view=${fitMode === 'fit-width' ? 'FitH' : fitMode === 'fit-page' ? 'Fit' : 'FitH'}`} 
              title={title || fileName}
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none', 
                minHeight: isFullscreen ? 'calc(100vh - 60px)' : '540px',
                display: 'block'
              }} 
            />
          </div>
        )}

        {/* TEXT / MARKDOWN PREVIEW */}
        {isText && (
          <div style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease'
          }}>
            <div style={{
              background: '#ffffff',
              color: '#0f172a',
              maxWidth: '840px',
              minHeight: '700px',
              margin: '0 auto',
              padding: '44px 50px',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
              borderRadius: '3px',
              fontFamily: "'Segoe UI', 'Calibri', monospace, sans-serif",
              fontSize: '0.96rem',
              lineHeight: 1.7
            }}>
              {loadingText ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải văn bản...</div>
              ) : textError ? (
                <div style={{ color: '#ef4444', textAlign: 'center', padding: '30px' }}>{textError}</div>
              ) : (
                <pre style={{ 
                  margin: 0, 
                  fontFamily: 'inherit', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  color: '#1e293b'
                }}>
                  {textContent}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {isImage && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '440px',
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease'
          }}>
            <img 
              src={fullUrl} 
              alt={fileName || 'Đề bài'} 
              style={{ 
                maxWidth: '90%', 
                height: 'auto', 
                borderRadius: '6px', 
                boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                background: '#ffffff',
                padding: '12px'
              }} 
            />
          </div>
        )}

        {/* OTHER FILES */}
        {!isPdf && !isImage && !isText && !isWord && (
          <div style={{ 
            maxWidth: '520px', 
            margin: '40px auto', 
            background: '#ffffff', 
            padding: '30px', 
            borderRadius: '8px', 
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
          }}>
            <FileText size={42} color="#0284c7" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1rem', color: '#0f172a', marginBottom: '6px' }}>{fileName || 'Tài Liệu Đề Bài'}</h4>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
              Định dạng tài liệu này không hỗ trợ xem trực tiếp. Bạn có thể tải về để mở trên máy tính.
            </p>
            <a 
              href={fullUrl} 
              download={fileName || 'file_de_bai'}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <Download size={14} /> Tải File Về Máy
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
