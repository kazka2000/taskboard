import React from 'react';
import styles from './InsightSummary.module.css';
import { useProject } from '../context/ProjectContext';

export function InsightSummary({ projects }) {
    const { t } = useProject();

    // Calculate Statistics
    let totalTasks = 0;
    let completedTasks = 0;
    let dueTodayTasks = 0;
    let overdueTasks = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    projects.forEach(project => {
        if (!project.columns) return;
        project.columns.forEach(column => {
            const isDoneColumn = column.title.toLowerCase() === 'done' || column.title === '완료';
            if (!column.tasks) return;

            column.tasks.forEach(task => {
                totalTasks++;
                if (isDoneColumn) {
                    completedTasks++;
                }

                if (task.deadline) {
                    const deadline = new Date(task.deadline);
                    deadline.setHours(0, 0, 0, 0);

                    if (!isDoneColumn) { // Only count pending tasks for due/overdue
                        if (deadline.getTime() === today.getTime()) {
                            dueTodayTasks++;
                        } else if (deadline.getTime() < today.getTime()) {
                            overdueTasks++;
                        }
                    }
                }
            });
        });
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className={styles.summaryContainer}>
            <h2 className={styles.title}>{t('insight.summary')}</h2>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>{t('insight.total_tasks')}</span>
                    <span className={styles.statValue}>{totalTasks}</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statLabel}>{t('insight.completed')}</span>
                    <span className={styles.statValue}>{completedTasks}</span>
                </div>
                <div className={`${styles.statCard} ${dueTodayTasks > 0 ? styles.warning : ''}`}>
                    <span className={styles.statLabel}>{t('insight.due_today')}</span>
                    <span className={styles.statValue}>{dueTodayTasks}</span>
                </div>
                <div className={`${styles.statCard} ${overdueTasks > 0 ? styles.danger : ''}`}>
                    <span className={styles.statLabel}>{t('insight.overdue')}</span>
                    <span className={styles.statValue}>{overdueTasks}</span>
                </div>
            </div>

            <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                    <span>{t('insight.progress')}</span>
                    <span className={styles.progressPercent}>{completionRate}%</span>
                </div>
                <div className={styles.progressBarBg}>
                    <div
                        className={styles.progressBarFill}
                        style={{ width: `${completionRate}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
