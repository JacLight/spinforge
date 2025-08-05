import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can also log the error to an error reporting service
    console.error('PropertyPanel Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  onReset = () => {
    this.resetErrorBoundary();
    if (this.props.onReset) {
      this.props.onReset();
    }
  };
  onRetry = () => {
    this.resetErrorBoundary();
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-lg font-medium text-red-800 mb-2">Something went wrong in the Component</h3>
          <div className="text-sm text-red-600 mb-4 flex items-center gap-5 p-2">
            <button className=' px-4 py-1 shadow bg-white text-gray-700' onClick={this.onReset}>Reset</button>
            <button className=' px-4 py-1 shadow  bg-white text-gray-700' onClick={this.onRetry}>Retry</button>
          </div>
          <details className="text-sm text-red-700">
            <summary>View error details</summary>
            <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto text-xs">
              {this.state.error?.toString()}
              <br />
              {this.state.errorInfo?.componentStack}
            </pre>
            <div className="text-xs text-red-500 mt-8">
              <p>{this.state.error.toString()}</p>
              <pre>{this.state.error.stack}</pre>
            </div>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
