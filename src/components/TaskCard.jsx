import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Calendar, FileText, CheckSquare, Edit2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './TaskCard.module.css';

const getPriorityColor = (priority) => {
    switch (priority) {
        case 'High': return '#ff5630';
        case 'Medium': return '#ffab00';
        case 'Low': return '#36b37e';
        default: return '#ccc';
    }
};

export function TaskCard({ task, updateTask, deleteTask, onTaskClick, onEdit, readOnly = false, project }) {
    const { users, selectedTaskIds, toggleTaskSelection } = useProject();

    // Defensive guard
    if (!task || !task.id) return null;

    const isSelected = selectedTaskIds.includes(task.id);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        data: {
            type: 'Task',
            task,
        },
        disabled: readOnly // Disable DnD if readOnly
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleToggleCheck = (e) => {
        if (readOnly) return;
        e.stopPropagation();
        if (toggleTaskSelection) toggleTaskSelection(task.id, true);
    };

    const handleClick = (e) => {
        if (readOnly) return; // Disable interactions if readOnly

        if (e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            toggleTaskSelection(task.id, true);
        } else if (selectedTaskIds.length > 0) {
            // Selection interactions
            if (toggleTaskSelection) toggleTaskSelection(task.id, true);
        } else {
            // Normal click - Open detail
            e.stopPropagation(); // Prevent bubbling

            if (onTaskClick) {
                onTaskClick(task);
            } else if (onEdit) {
                onEdit(task);
            } else {
                console.warn('No click handler provided for TaskCard');
            }
        }
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`${styles.card} ${styles.dragging} ${isSelected ? styles.selected : ''}`}
            />
        );
    }

    const assigneesList = (task.assignees || []).map(entry => {
        if (typeof entry === 'object') return entry;
        return users.find(u => u.id === entry);
    }).filter(Boolean) || [];

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
            onClick={handleClick}
        >
            <div className={styles.checkboxContainer} onClick={handleToggleCheck}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className={styles.selectionCheckbox}
                />
            </div>

            <div className={styles.header}>
                {task.cover_image && (
                    <div className={styles.coverImageContainer}>
                        <img
                            src={`http://localhost:3000${task.cover_image}`}
                            alt="Cover"
                            className={styles.coverImage}
                        />
                    </div>
                )}
                {task.labels && task.labels.length > 0 ? (
                    <div className={styles.labelsContainer}>
                        {task.labels.map(label => (
                            <span
                                key={label.id}
                                className={styles.label}
                                style={{ backgroundColor: label.color }}
                                title={label.name}
                            >
                                {label.name}
                            </span>
                        ))}
                    </div>
                ) : null}
                <div className={styles.actions}>
                    <div
                        className={styles.priorityIndicator}
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                        title={`Priority: ${task.priority}`}
                    />
                    {!readOnly && (
                        <button className={styles.editBtn} onClick={(e) => {
                            e.stopPropagation();
                            onTaskClick(task);
                        }}>
                            <Edit2 size={12} />
                        </button>
                    )}
                    <button {...attributes} {...listeners} className={styles.grip}>
                        <GripVertical size={16} />
                    </button>
                </div>
            </div>
            <p className={styles.title}>{task.title}</p>

            <div className={styles.footer}>
                <div className={styles.metaLeft}>
                    {task.deadline && (
                        <div className={styles.metaItem} title="Deadline">
                            <Calendar size={12} />
                            <span>
                                {(() => {
                                    const d = new Date(task.deadline);
                                    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
                                })()}
                            </span>
                        </div>
                    )}
                    {task.checklist_total > 0 && (
                        <div className={styles.metaItem} title="Checklist progress">
                            <CheckSquare size={12} />
                            <span>{task.checklist_done}/{task.checklist_total}</span>
                        </div>
                    )}
                    {task.description && (
                        <div className={styles.metaItem} title="Has description">
                            <FileText size={12} />
                        </div>
                    )}
                    {task.attachment_count > 0 && (
                        <div className={styles.metaItem} title="Attachments">
                            <span className={styles.clipIcon}>📎</span>
                            <span>{task.attachment_count}</span>
                        </div>
                    )}
                </div>

                {/* Custom Fields Display */}
                {task.customFieldValues && task.customFieldValues.length > 0 && project && (
                    <div className={styles.customFields}>
                        {task.customFieldValues.map(val => {
                            const def = project.customFields?.find(f => f.id === val.field_definition_id);
                            if (!def) return null;
                            if (def.type === 'checkbox' && val.value !== 'true') return null; // Show only checked?

                            return (
                                <div key={val.id} className={styles.customFieldBadge} title={`${def.name}: ${val.value}`}>
                                    {def.type === 'checkbox' ? (
                                        <span className={styles.checkboxBadge}>✓ {def.name}</span>
                                    ) : (
                                        <span>{val.value}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {assigneesList.length > 0 && (
                    <div className={styles.assignees}>
                        {assigneesList.map(user => (
                            <span
                                key={user.id}
                                className={styles.assigneeInitials}
                                title={user.name}
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}
