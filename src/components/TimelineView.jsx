import React, { useMemo } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import styles from './TimelineView.module.css';

class GanttErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Gantt Chart Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
                    <h3>Timeline Error</h3>
                    <p>{this.state.error?.toString()}</p>
                    <p>Please check console for details.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export function TimelineView({ tasks, updateTask, onTaskClick }) {
    const ganttTasks = useMemo(() => {
        return tasks.map(task => {
            // Start Date: startDate > created_at > new Date()
            let start = task.startDate ? new Date(task.startDate) : (task.created_at ? new Date(task.created_at) : new Date());

            // Validate Start Date
            if (isNaN(start.getTime())) {
                start = new Date(); // Fallback to now
            }

            // End Date: deadline
            let end = task.deadline ? new Date(task.deadline) : new Date(start.getTime() + 24 * 60 * 60 * 1000);

            // Validate End Date
            if (isNaN(end.getTime())) {
                end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            }

            // Should ensure end > start
            if (end <= start) {
                end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            }

            return {
                start: start,
                end: end,
                name: task.title || 'Untitled Task',
                id: String(task.id),
                type: 'task',
                progress: task.status === 'Done' || task.status === 'Completed' ? 100 : 50,
                isDisabled: false,
                styles: {
                    progressColor: task.label?.color || '#ffbb54',
                    progressSelectedColor: '#ff9e0d',
                },
                project_id: task.project_id
            };
        }).filter(t => !isNaN(t.start.getTime()) && !isNaN(t.end.getTime())); // Double check
    }, [tasks]);

    const handleTaskChange = (task) => {
        const newDeadline = task.end;

        const year = newDeadline.getFullYear();
        const month = String(newDeadline.getMonth() + 1).padStart(2, '0');
        const day = String(newDeadline.getDate()).padStart(2, '0');
        const deadlineStr = `${year}-${month}-${day}`;

        updateTask(task.id, { deadline: deadlineStr });
    };

    const handleDblClick = (task) => {
        const originalTask = tasks.find(t => String(t.id) === task.id);
        if (originalTask && onTaskClick) {
            onTaskClick(originalTask);
        }
    };

    if (ganttTasks.length === 0) {
        return <div className={styles.emptyState}>No tasks to display in timeline.</div>;
    }

    return (
        <div className={styles.timelineWrapper}>
            <GanttErrorBoundary>
                <Gantt
                    tasks={ganttTasks}
                    viewMode={ViewMode.Day}
                    onDateChange={handleTaskChange}
                    onDoubleClick={handleDblClick}
                    listCellWidth="155px"
                    columnWidth={60}
                />
            </GanttErrorBoundary>
        </div>
    );
}
