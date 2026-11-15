import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('AURA//PLAYER ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      for (const key of ['auraplayer-auth', 'spotify_verifier', 'spotify_oauth_state', 'spotify_redirect_uri']) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
    } catch {}
    window.location.href = `${window.location.origin}/`;
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="error-boundary-screen" role="alert">
          <div className="error-boundary-card">
            <div className="error-card-badge">
              <AlertTriangle size={16} />
              <span>AURA//PLAYER CRASH CAUGHT</span>
            </div>

            <h1 className="error-card-title">SOMETHING BROKE</h1>
            <p className="error-card-lead">
              The application encountered an unhandled rendering error. Stale Spotify tokens or unexpected track metadata have been isolated.
            </p>

            <div className="error-details-box">
              <strong>ERROR:</strong>
              <pre>{errorMessage}</pre>
              {componentStack && (
                <details className="error-stack-details">
                  <summary>VIEW COMPONENT TRACE</summary>
                  <pre>{componentStack.slice(0, 500)}</pre>
                </details>
              )}
            </div>

            <div className="error-actions-row">
              <button className="error-reset-btn" onClick={this.handleReset}>
                <Trash2 size={16} />
                <span>RESET & CLEAR STORAGE</span>
              </button>
              <button className="error-reload-btn" onClick={this.handleReload}>
                <RotateCcw size={16} />
                <span>RELOAD PAGE</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
