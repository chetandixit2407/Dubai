import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-6">
          <div className="max-w-lg w-full bg-white border border-[#E5E2DC] p-8">
            <p className="text-xs tracking-widest uppercase text-[#9A7B3C] font-medium mb-2">
              WHITE COLLAR REALTY
            </p>
            <h1 className="font-display text-2xl font-semibold text-[#111827] mb-3">
              Unable to load this view
            </h1>
            <p className="text-sm text-[#4B5563] mb-6 leading-relaxed">
              We encountered a temporary error while synchronizing data. Please reload the page to restore your session.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#111827] text-white text-sm font-medium hover:bg-[#1F2937] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
