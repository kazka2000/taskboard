import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { X, Trash2, ArrowRight, Tag, UserPlus } from 'lucide-react';
import styles from './BulkActionBar.module.css';

export function BulkActionBar({ project }) {
    const { selectedTaskIds, clearTaskSelection, bulkUpdateTasks, users } = useProject();
    const [actionStep, setActionStep] = useState(null); // 'move', 'label', 'assign'

    if (selectedTaskIds.length === 0) return null;

    const handleMove = (listId) => {
        bulkUpdateTasks(selectedTaskIds, { listId });
        setActionStep(null);
    };

    const handleLabel = (labelId) => {
        bulkUpdateTasks(selectedTaskIds, { labels: [labelId], labelMode: 'add' });
        setActionStep(null);
    };

    const handleAssign = (userId) => {
        bulkUpdateTasks(selectedTaskIds, { assignees: [userId], assigneeMode: 'add' });
        setActionStep(null);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} tasks?`)) {
            bulkUpdateTasks(selectedTaskIds, { delete: true });
        }
    };

    return (
        <div className={styles.barContainer}>
            <div className={styles.stats}>
                <span className={styles.count}>{selectedTaskIds.length}</span>
                <span className={styles.text}>Selected</span>
                <button className={styles.clearBtn} onClick={clearTaskSelection}><X size={16} /></button>
            </div>

            <div className={styles.actions}>
                <div className={styles.actionGroup}>
                    <button
                        className={`${styles.actionBtn} ${actionStep === 'move' ? styles.active : ''}`}
                        onClick={() => setActionStep(actionStep === 'move' ? null : 'move')}
                    >
                        <ArrowRight size={16} /> Move
                    </button>

                    {actionStep === 'move' && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownHeader}>Select List</div>
                            {project.columns?.map(col => (
                                <button key={col.id} className={styles.dropdownItem} onClick={() => handleMove(col.dbId)}>
                                    {col.title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.actionGroup}>
                    <button
                        className={`${styles.actionBtn} ${actionStep === 'label' ? styles.active : ''}`}
                        onClick={() => setActionStep(actionStep === 'label' ? null : 'label')}
                    >
                        <Tag size={16} /> Label
                    </button>
                    {actionStep === 'label' && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownHeader}>Add Label</div>
                            {project.labels?.map(label => (
                                <button key={label.id} className={styles.dropdownItem} onClick={() => handleLabel(label.id)}>
                                    <span className={styles.colorDot} style={{ backgroundColor: label.color }}></span>
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.actionGroup}>
                    <button
                        className={`${styles.actionBtn} ${actionStep === 'assign' ? styles.active : ''}`}
                        onClick={() => setActionStep(actionStep === 'assign' ? null : 'assign')}
                    >
                        <UserPlus size={16} /> Assign
                    </button>
                    {actionStep === 'assign' && (
                        <div className={styles.dropdown}>
                            <div className={styles.dropdownHeader}>Assign Member</div>
                            {users.map(user => (
                                <button key={user.id} className={styles.dropdownItem} onClick={() => handleAssign(user.id)}>
                                    <div className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
                                    {user.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={handleDelete}>
                    <Trash2 size={16} /> Delete
                </button>
            </div>
        </div>
    );
}
