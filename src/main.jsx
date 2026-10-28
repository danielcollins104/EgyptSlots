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
          <h1 style={{ fontSize: '1.8rem', color: '#ef4444' }}>Something went wrong</h1>
          <pre style={{
            background: 'rgba(0,0,0,0.6)',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '800px',
            overflowX: 'auto',
            color: '#fde047'
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '18px',
              padding: '10px 24px',
              fontSize: '1rem',
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
