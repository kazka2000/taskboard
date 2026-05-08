import React, { useEffect, useRef } from 'react';
import styles from './TaskModal.module.css';

export function TaskAILog({ logs }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className={styles.aiLogContainer}>
            <div className={styles.aiLogHeader}>
                <span className={styles.terminalIcon}>&gt;_</span>
                <span className={styles.terminalTitle}>AI Ghostworker Terminal</span>
            </div>
            <div className={styles.aiLogBody}>
                {logs.map((log, index) => (
                    <div key={index} className={styles.logLine}>
                        <span className={styles.prompt}>$</span> {log}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
