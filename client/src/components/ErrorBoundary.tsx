import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RenixLoader } from './RenixLoader';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/projects';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="renix-surface flex flex-col items-center justify-center h-full min-h-[300px] gap-6 p-8"
          data-testid="error-boundary"
        >
          <RenixLoader size="xl" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h2
              className="text-xl font-semibold text-foreground"
              data-testid="text-error-title"
            >
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p
              className="text-sm text-muted-foreground max-w-md"
              data-testid="text-error-message"
            >
              An unexpected error occurred. You can try again or navigate back to the home page.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={this.handleReset}
              data-testid="button-try-again"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={this.handleGoHome}
              data-testid="link-go-home"
            >
              Go Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
