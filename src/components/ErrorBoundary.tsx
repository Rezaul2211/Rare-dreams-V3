import React, { Component, ErrorInfo, ReactNode } from "react";

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

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 m-4 rounded-xl font-mono text-xs">
          <h1 className="font-bold text-lg mb-4">React Error!</h1>
          <p>{this.state.error?.message}</p>
          <pre className="mt-4 whitespace-pre-wrap">{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
