import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[KitaCom] Uncaught React render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#1e293b', color: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>⚠️ Terjadi Kesalahan Render Aplikasi</h2>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>Aplikasi mengalami masalah saat memuat antarmuka:</p>
          <pre style={{ background: '#0f172a', padding: 12, borderRadius: 8, fontSize: '12px', overflowX: 'auto', color: '#fca5a5' }}>
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: 16, padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold' }}>
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)

