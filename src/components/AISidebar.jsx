import React from 'react';
import { useAI } from '../context/AIContext';
import { TaskAIChat } from './TaskAIChat';
import styles from './AISidebar.module.css';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

export function AISidebar() {
    const { isSidebarOpen, toggleSidebar, activeTask } = useAI();

    if (!isSidebarOpen) {
        return (
            <button className={styles.triggerBtn} onClick={toggleSidebar} title="AI Partner">
                <ChevronLeft size={20} />
            </button>
        );
    }

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <div className={styles.status}>
                    {activeTask ? (
                        <span className={styles.watching}>
                            Watching: <strong>{activeTask.title.length > 15 ? activeTask.title.substring(0, 15) + '...' : activeTask.title}</strong>
                        </span>
                    ) : (
                        <span>Project Overview</span>
                    )}
                </div>
                <button onClick={toggleSidebar} className={styles.closeBtn}>
                    <ChevronRight size={20} />
                </button>
            </div>
            <div className={styles.content}>
                <TaskAIChat compact={false} />
            </div>
        </div>
    );
}
