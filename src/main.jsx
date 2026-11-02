import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  handleClearSessionAndReload = () => {
    try {
      localStorage.removeItem('dc_casino_user_auth');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  handleFullResetAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0c0414',
          color: '#fbbf24',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '1.8rem', color: '#ef4444', marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '16px', maxWidth: '600px' }}>
            An unexpected error occurred during execution. If the page does not reload normally, use the recovery options below.
          </p>
          <pre style={{
            background: 'rgba(0,0,0,0.6)',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '800px',
            overflowX: 'auto',
            color: '#fde047',
            border: '1px solid rgba(251, 191, 36, 0.2)'
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                background: '#fbbf24',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
            <button
              onClick={this.handleClearSessionAndReload}
              style={{
                padding: '10px 20px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                background: 'rgba(0, 229, 255, 0.2)',
                color: '#00e5ff',
                border: '1px solid #00e5ff',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Reset Session &amp; Recover
            </button>
            <button
              onClick={this.handleFullResetAndReload}
              style={{
                padding: '10px 20px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Full Clean Reset
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
