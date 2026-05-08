import React, { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from './TaskCard';
import styles from './Column.module.css';

import { Plus, MoreVertical, Edit2, Trash2, X, Check, GripVertical } from 'lucide-react';

export function Column({ column, onAdd, onDelete, onEdit, onUpdateList, onDeleteList, isOverlay, readOnly = false }) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: column.id,
        data: {
            type: 'Column',
            column,
        },
        disabled: readOnly // Disable sorting if readOnly
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(column.title);
    const [showMenu, setShowMenu] = useState(false);

    const handleSaveTitle = () => {
        if (editTitle.trim() && editTitle !== column.title) {
            onUpdateList(column.dbId, editTitle);
        }
        setIsEditing(false);
        setShowMenu(false);
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.column}>
            <div className={styles.header}>
                {!readOnly && (
                    <div
                        {...attributes}
                        {...listeners}
                        className={styles.dragHandle}
                        style={{ cursor: 'grab', marginRight: '8px', display: 'flex', alignItems: 'center', color: '#888' }}
                    >
                        <GripVertical size={20} />
                    </div>
                )}
                {isEditing ? (
                    <div className={styles.editTitleForm}>
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            className={styles.titleInput}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveTitle();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                        />
                        <div className={styles.editActions}>
                            <button onClick={handleSaveTitle} className={styles.iconBtn}><Check size={16} /></button>
                            <button onClick={() => setIsEditing(false)} className={styles.iconBtn}><X size={16} /></button>
                        </div>
                    </div>
                ) : (
                    <h2 className={styles.title}>
                        {column.title}
                        <span className={styles.count}>{(column.tasks || []).length}</span>
                    </h2>
                )}

                <div className={styles.headerActions}>
                    <div className={styles.menuContainer}>
                        <button onClick={() => setShowMenu(!showMenu)} className={styles.menuBtn}>
                            <MoreVertical size={16} />
                        </button>
                        {showMenu && (
                            <div className={styles.dropdownMenu}>
                                <button onClick={() => setIsEditing(true)} className={styles.menuItem}>
                                    <Edit2 size={14} /> Rename
                                </button>
                                <button onClick={() => {
                                    if (confirm('Delete list "' + column.title + '" and all its tasks?')) {
                                        onDeleteList(column.dbId);
                                    }
                                    setShowMenu(false);
                                }} className={`${styles.menuItem} ${styles.deleteItem}`}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        )}
                        {showMenu && <div className={styles.menuOverlay} onClick={() => setShowMenu(false)} />}
                    </div>
                    {onAdd && !readOnly && (
                        <button onClick={() => onAdd(column.id)} className={styles.addBtn} aria-label="Add task">
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.taskList}>
                <SortableContext
                    items={(column.tasks || []).map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {(column.tasks || []).map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            project={column.project}
                            onDelete={onDelete}
                            onEdit={onEdit}
                            readOnly={readOnly}
                        />
                    ))}
                </SortableContext>
                {(column.tasks || []).length === 0 && (
                    <div className={styles.emptyPlaceholder}>Drop tasks here</div>
                )}
            </div>
        </div>
    );
}
