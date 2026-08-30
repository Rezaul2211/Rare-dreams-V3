import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public handleReload = () => {
    try {
      window.location.reload();
    } catch (e) {
      window.location.href = '/';
    }
  };

  public handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4 bg-[#F8F7FC]">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-neutral-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-1">
                পেজ লোড করতে সাময়িক সমস্যা হয়েছে
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500">
                ইন্টারনেট সংযোগ বা সাময়িক বাধার কারণে পেজটি খোলা যায়নি। দয়া করে পুনরায় চেষ্টা করুন।
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="bg-[#5B46E8] hover:bg-[#4F39F6] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw size={14} />
                <span>রিলোড করুন</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Home size={14} />
                <span>হোমে ফিরুন</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

