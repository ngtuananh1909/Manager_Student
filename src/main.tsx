import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Fix Monaco Editor in Electron (sandbox:true + no CDN access on LAN).
// Provides a no-op web worker so Monaco falls back to main-thread mode.
// Syntax highlighting & editing still work; IntelliSense workers are skipped.
if (typeof window !== 'undefined' && !(window as any).MonacoEnvironment) {
  (window as any).MonacoEnvironment = {
    getWorker(_moduleId: string, _label: string): Worker {
      const blob = new Blob(['self.onmessage=()=>{}'], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob));
    }
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
