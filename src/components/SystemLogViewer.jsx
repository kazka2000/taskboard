import React, { useEffect, useState } from 'react';
import { Terminal, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

export function SystemLogViewer() {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    const fetchLogs = async () => {
        try {
            // Cache busting
            const res = await axios.get(`http://localhost:3000/api/debug/logs?t=${Date.now()}`);
            if (res.data.success) {
                setLogs(res.data.logs.reverse()); // Newest first
            }
        } catch (e) {
            console.error('Failed to fetch logs', e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
            const interval = setInterval(fetchLogs, 2000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '20px',
                    zIndex: 9999,
                    background: '#1e293b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
            >
                <Terminal size={20} />
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: '600px',
            height: '400px',
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'Fira Code', monospace",
            fontSize: '12px'
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#e2e8f0',
                fontWeight: 600
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={14} color="#3b82f6" />
                    <span>System Logs (Live)</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchLogs} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={14} />
                    </button>
                </div>
            </div>
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                color: '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                {logs.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.5 }}>No logs captured yet...</div>
                ) : (
                    logs.map((log, idx) => (
                        <div key={idx} style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: log.includes('[ERROR]') ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            color: log.includes('[ERROR]') ? '#f87171' : log.includes('[AI-DEBUG]') ? '#60a5fa' : '#94a3b8',
                            borderLeft: log.includes('[ERROR]') ? '2px solid #ef4444' : log.includes('[AI-DEBUG]') ? '2px solid #3b82f6' : 'none'
                        }}>
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
