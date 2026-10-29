import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAutoUpdater } from './utils/autoUpdater';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Gig Efficiency Tracker runtime error:', error, errorInfo);
  }

  handleResetState = () => {
    try {
      localStorage.removeItem('gig_tracker_active_session');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-2xl font-bold shadow-md">
              ⚡
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Gig Efficiency Tracker
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                A temporary display error occurred while restoring data.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-left text-xs text-rose-700 dark:text-rose-300 font-mono overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleResetState}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-98 cursor-pointer"
              >
                Reload & Resume Shift
              </button>
              <button
                onClick={this.handleHardReset}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all cursor-pointer"
              >
                Reset Stored Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Initialize automatic newest-version checker and service worker lifecycle
initAutoUpdater();

