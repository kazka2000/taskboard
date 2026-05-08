import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: '#ef4444', backgroundColor: '#fef2f2', height: '100vh', overflow: 'auto' }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
                    <div style={{ marginBottom: '1rem', fontFamily: 'monospace', backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #fee2e2' }}>
                        <strong>{this.state.error && this.state.error.toString()}</strong>
                    </div>
                    <details style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>View Component Stack</summary>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <div style={{ marginTop: '2rem' }}>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
