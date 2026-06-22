import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary captured an error:', error, info);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Algo deu errado
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Ocorreu um erro inesperado na aplicação. Recarregue a página para tentar novamente.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-left text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-3 mb-4 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }
}
