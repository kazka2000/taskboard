import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
    SortableContext,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Column } from '../components/Column';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { BoardHeader } from '../components/BoardHeader';
import { CustomFieldSettingsModal } from '../components/CustomFieldSettingsModal';
import { useProject } from '../context/ProjectContext';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { BulkActionBar } from './BulkActionBar';
import { WebhookSettingsModal } from './WebhookSettingsModal';
import { BoardSettingsSidebar } from './BoardSettingsSidebar';
import styles from './Board.module.css';

import { isColorLight } from '../utils/colorUtils';
import { Settings } from 'lucide-react';
import axios from 'axios';

// ... (existing imports)

export function Board() {
    const { projectId } = useParams();
    // console.log("Rendering Board, projectId:", projectId);

    // Safety check for context
    const projectContext = useProject();
    if (!projectContext) {
        console.error("ProjectContext is missing!");
        return <div>Error: Context missing</div>;
    }
    const { projects, updateProjectColumns, addTask, updateTask, deleteTask, users, currentUser, t, updateProject, loading, addList, updateList, deleteList, reorderLists, socket, clearTaskSelection } = projectContext;

    const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

    // ESC Key to clear selection
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                clearTaskSelection();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearTaskSelection]);

    // View State
    const [viewMode, setViewMode] = useState('board'); // 'board' or 'analytics'

    // Derived state
    const project = projects.find(p => p.id === parseInt(projectId));

    // Local state for DnD
    const [columns, setColumns] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [activeTask, setActiveTask] = useState(null);
    const [activeColumn, setActiveColumn] = useState(null);

    // Modals state
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isProjectEditModalOpen, setIsProjectEditModalOpen] = useState(false);
    const [isAddListModalOpen, setIsAddListModalOpen] = useState(false);
    const [isCustomFieldsSettingsOpen, setIsCustomFieldsSettingsOpen] = useState(false); // Settings for Custom Fields
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Board Settings Sidebar

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [filterTag, setFilterTag] = useState('all');
    const [filterDeadline, setFilterDeadline] = useState('all');

    // Edit Project State
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');

    // Add List State
    const [newListTitle, setNewListTitle] = useState('');

    // Task Editing
    const [editingTask, setEditingTask] = useState(null);
    const [activeColumnId, setActiveColumnId] = useState(null);

    // Initialize edit state when modal opens
    useEffect(() => {
        if (isProjectEditModalOpen && project) {
            setEditTitle(project.title);
            setEditDescription(project.description || '');
            setEditStartDate(project.start_date ? project.start_date.split('T')[0] : '');
            setEditEndDate(project.end_date ? project.end_date.split('T')[0] : '');
        }
    }, [isProjectEditModalOpen, project]);

    // Derived State: Columns with Filtering
    useEffect(() => {
        if (project) {
            setColumns(project.columns || []);
        }
    }, [project]);

    const displayColumns = useMemo(() => {
        if (!project) return [];
        let cols = columns;

        // Filter Logic
        cols = cols.map(col => {
            const tasks = (col.tasks || []).filter(task => {
                // Search
                if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;

                // Assignee
                if (filterAssignee !== 'all') {
                    if (filterAssignee === 'unassigned') {
                        if (task.assignees && task.assignees.length > 0) return false;
                    } else {
                        // Check if user ID is in assignees
                        // Assignees might be objects {id, username...} or IDs.
                        // Based on context, they are usually mapped objects.
                        if (!task.assignees || !task.assignees.find(u => u.id === parseInt(filterAssignee))) return false;
                    }
                }

                // Tag/Label
                if (filterTag !== 'all') {
                    // Start simple: check labels
                    if (!task.labels || !task.labels.find(l => l.id === parseInt(filterTag))) return false;
                }

                // Deadline
                if (filterDeadline !== 'all') {
                    if (!task.deadline) return false;
                    const today = new Date();
                    const deadline = new Date(task.deadline);
                    const diffTime = deadline - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (filterDeadline === 'today') {
                        // Same day check
                        if (today.toDateString() !== deadline.toDateString()) return false;
                    } else if (filterDeadline === 'week') {
                        if (diffDays < 0 || diffDays > 7) return false;
                    } else if (filterDeadline === 'overdue') {
                        if (diffTime < 0) return true;
                        return false;
                    }
                }

                return true;
            });
            return { ...col, tasks };
        });

        return cols;
    }, [project, columns, searchTerm, filterAssignee, filterTag, filterDeadline]);

    const hasResults = useMemo(() => {
        return displayColumns.some(c => c.tasks.length > 0);
    }, [displayColumns]);


    // Handlers
    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);

        // Find task or column
        if (active.data.current?.type === 'Column') {
            setActiveColumn(active.data.current.column);
            return;
        }

        if (active.data.current?.type === 'Task') {
            setActiveTask(active.data.current.task);
            return;
        }
    };

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === 'Task';
        const isOverTask = over.data.current?.type === 'Task';

        if (!isActiveTask) return;

        // Find source and dest columns
        const findColumn = (id) => {
            return columns.find(col => col.tasks.find(t => t.id === id)) ||
                columns.find(col => col.id === id); // id might be 'list-X'
        };

        const activeColumn = findColumn(activeId);
        const overColumn = isOverTask ? findColumn(overId) : columns.find(col => col.id === overId);

        if (!activeColumn || !overColumn) return;

        if (activeColumn !== overColumn) {
            setColumns(prev => {
                const activeItems = activeColumn.tasks;
                const overItems = overColumn.tasks;
                const activeIndex = activeItems.findIndex(t => t.id === activeId);
                const overIndex = isOverTask ? overItems.findIndex(t => t.id === overId) : overItems.length + 1;

                let newIndex;
                if (isOverTask) {
                    newIndex = overItems.findIndex(t => t.id === overId);
                    const isBelowOverItem = over && active.rect.current.translate && active.rect.current.translate.y > over.rect.top + over.rect.height;
                    const modifier = isBelowOverItem ? 1 : 0;
                    newIndex = newIndex >= 0 ? newIndex + modifier : overItems.length + 1;
                } else {
                    newIndex = overItems.length + 1;
                }

                return prev.map(c => {
                    if (c.id === activeColumn.id) {
                        return { ...c, tasks: activeItems.filter(t => t.id !== activeId) };
                    }
                    if (c.id === overColumn.id) {
                        const newTasks = [...overItems];
                        // Avoid duplicates if drag over fires repeatedly (dnd-kit usually handles via unique IDs but optimistic updates need care)
                        // Actually dnd-kit assumes we update state.
                        // We must insert activeTask into newTasks.
                        // But activeTask might be stale. We use active.data.current.task
                        const taskToMove = active.data.current.task;

                        // Check if already in
                        if (!newTasks.find(t => t.id === taskToMove.id)) {
                            newTasks.splice(newIndex, 0, { ...taskToMove, listId: overColumn.dbId });
                        }
                        return { ...c, tasks: newTasks };
                    }
                    return c;
                });
            });
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveTask(null);
        setActiveColumn(null);

        if (!over) return;

        // Column Reordering
        if (active.data.current?.type === 'Column') {
            if (active.id !== over.id) {
                const oldIndex = columns.findIndex(c => c.id === active.id);
                const newIndex = columns.findIndex(c => c.id === over.id);
                const newCols = arrayMove(columns, oldIndex, newIndex);
                setColumns(newCols);
                // Persist
                // Extract list IDs (dbId)
                reorderLists(project.id, newCols.map(c => c.dbId));
            }
            return;
        }

        // Task Reordering
        // We already updated state in DragOver for cross-column.
        // DragEnd handles final commit and same-column reorder.
        const activeId = active.id;
        const overId = over.id;

        const findColumn = (id) => {
            return columns.find(col => col.tasks.find(t => t.id === id)) ||
                columns.find(col => col.id === id);
        };
        const activeColumn = findColumn(activeId);
        const overColumn = findColumn(overId) || columns.find(col => col.id === overId);

        if (activeColumn && overColumn) {
            const activeIndex = activeColumn.tasks.findIndex(t => t.id === activeId);
            const overIndex = overColumn.tasks.findIndex(t => t.id === overId);

            if (activeColumn === overColumn) {
                // Same column reorder
                if (activeIndex !== overIndex) {
                    const newTasks = arrayMove(activeColumn.tasks, activeIndex, overIndex);
                    const newCols = columns.map(c => c.id === activeColumn.id ? { ...c, tasks: newTasks } : c);
                    setColumns(newCols);
                    // Persist
                    updateProjectColumns(project.id, newCols, activeColumn.tasks[activeIndex], overIndex);
                }
            } else {
                // Different column
                // Logic handled in DragOver, but we need to persist.
                // activeColumn in state already lost the task in DragOver.
                // overColumn has it.
                // We just need to find the task in overColumn and call API.
                const task = overColumn.tasks.find(t => t.id === activeId);
                const newPos = overColumn.tasks.findIndex(t => t.id === activeId);
                if (task) {
                    updateProjectColumns(project.id, columns, task, newPos);
                }
            }
        }
    };

    const handleDeleteTask = (taskId) => {
        if (window.confirm(t('confirmDelete'))) {
            deleteTask(project.id, taskId); // Adjust if deleteTask only needs taskId
        }
    };

    const handleAddList = (e) => {
        e.preventDefault();
        if (newListTitle.trim()) {
            addList(project.id, newListTitle);
            setNewListTitle('');
            setIsAddListModalOpen(false);
        }
    };

    const handleUpdateProject = (e) => {
        e.preventDefault();
        updateProject(project.id, editTitle, editDescription, editStartDate, editEndDate);
        setIsProjectEditModalOpen(false);
    };

    const openModal = (columnId = null, task = null) => {
        setActiveColumnId(columnId);
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };

    // Background & Theme Logic
    const backgroundStyle = useMemo(() => {
        if (!project) return {};

        // Use preview if available, otherwise project data
        const bgState = previewBackground || {
            type: project.background_type || 'color',
            value: project.background_value || 'default'
        };

        const bgType = bgState.type;
        const bgValue = bgState.value;

        if (bgType === 'image') {
            // If it's a data URL (preview), usage is direct.
            // If it's a path (saved), prepend host if needed.
            // Data URL starts with 'data:'
            const url = bgValue.startsWith('data:') ? bgValue : `http://localhost:3000${bgValue}`;

            return {
                backgroundImage: `url(${url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '--project-text-color': '#ffffff',
                '--project-text-shadow': '0 2px 4px rgba(0,0,0,0.5)',
                '--board-list-bg': 'rgba(255, 255, 255, 0.2)',
                '--board-card-bg': 'rgba(255, 255, 255, 0.9)',
            };
        } else {
            // Color
            const color = bgValue === 'default' ? '#ffffff' : bgValue;
            if (bgValue === 'default' && !bgState.type) return {}; // Default

            const isLight = isColorLight(color);
            return {
                backgroundColor: color,
                backgroundImage: 'none',
                '--project-text-color': isLight ? '#171717' : '#ffffff',
                '--board-list-bg': isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.12)',
                '--board-card-bg': isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.95)',
                '--project-text-shadow': 'none'
            };
        }
    }, [project, previewBackground]);

    const handleSaveSettings = async () => {
        if (!previewBackground) {
            setIsSettingsOpen(false);
            return;
        }

        try {
            let finalValue = previewBackground.value;

            // If it's a file upload (we stored 'file' in preview object in Sidebar), upload now
            if (previewBackground.file) {
                const formData = new FormData();
                formData.append('file', previewBackground.file);
                // POST to project upload endpoint
                const res = await axios.post(`http://localhost:3000/api/projects/${projectId}/background`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.success) {
                    finalValue = res.data.filePath;
                }
            }

            await updateProject(project.id, undefined, undefined, undefined, undefined, {
                type: previewBackground.type,
                value: finalValue
            });
            setIsSettingsOpen(false);
            setPreviewBackground(null);
        } catch (error) {
            console.error("Failed to save background settings", error);
            alert("Failed to save background");
        }
    };

    const handleCloseSettings = () => {
        setIsSettingsOpen(false);
        setPreviewBackground(null); // Reset preview
    };

    // ...

    // ...

    if (loading) {
        return <div className={styles.loading}>{t('loading')}</div>;
    }

    if (!project) {
        return <div className={styles.notFound}>{t('projectNotFound')}</div>;
    }

    return (
        <div className={styles.boardContainer} style={backgroundStyle}>
            <div className={styles.header}>

                <div className={styles.titleRow}>
                    <Link to="/" className={styles.backLink}>← {t('backToDashboard')}</Link>
                    <h1>{project.title}</h1>
                    {(currentUser?.id === project.owner_id || currentUser?.role === 'admin') && (
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            <button
                                className={styles.editProjectBtn}
                                onClick={() => setIsProjectEditModalOpen(true)}
                            >
                                {t('editProject')}
                            </button>
                            <button
                                className={styles.editProjectBtn}
                                onClick={() => setIsSettingsOpen(true)}
                                title={t('boardSettings')}
                            >
                                <Settings size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* View Switcher Tabs */}
                <div className={styles.viewSwitcher}>
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'board' ? styles.activeView : ''}`}
                        onClick={() => setViewMode('board')}
                    >
                        Board
                    </button>
                    {/*
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'analytics' ? styles.activeView : ''}`}
                        onClick={() => setViewMode('analytics')}
                    >
                        Analytics
                    </button>
                    */}
                </div>

                {(project.description || project.start_date || project.end_date) && (
                    <div className={styles.projectInfo}>
                        {project.description && (
                            <div className={styles.descriptionSection}>
                                <span className={styles.infoLabel}>{t('projectDescription')}:</span>
                                <p className={styles.descriptionText}>{project.description}</p>
                            </div>
                        )}
                        {(project.start_date || project.end_date) && (
                            <div className={styles.periodSection}>
                                <span className={styles.infoLabel}>{t('projectPeriod')}:</span>
                                <span className={styles.periodText}>
                                    {project.start_date ? new Date(project.start_date).toLocaleDateString('fr-CA') : '?'}
                                    {' ~ '}
                                    {project.end_date ? new Date(project.end_date).toLocaleDateString('fr-CA') : '?'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.boardHeader}>
                    <BoardHeader
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterAssignee={filterAssignee}
                        onFilterAssigneeChange={setFilterAssignee}
                        filterTag={filterTag}
                        onFilterTagChange={setFilterTag}
                        filterDeadline={filterDeadline}
                        onFilterDeadlineChange={setFilterDeadline}
                        sortOption={sortOption}
                        onSortChange={setSortOption}
                        users={users}
                    // labels={project?.labels}
                    // onOpenSettings={() => setIsCustomFieldsSettingsOpen(true)}
                    />
                </div>

                {/*
                <BulkActionBar project={project} />
                */}

                <CustomFieldSettingsModal
                    isOpen={isCustomFieldsSettingsOpen}
                    onClose={() => setIsCustomFieldsSettingsOpen(false)}
                    project={project}
                />
            </div>

            {!hasResults ? (
                <div className={styles.noResults}>
                    <p>{t('noSearchResults') || 'No matching tasks found.'}</p>
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFilterAssignee('all');
                            setFilterTag('all');
                            setFilterDeadline('all');
                        }}
                        className={styles.resetFiltersBtn}
                    >
                        Reset Filters
                    </button>
                </div>
            ) : viewMode === 'analytics' ? (
                <AnalyticsDashboard
                    onFilterAssignee={(userId) => {
                        setFilterAssignee(userId);
                        setViewMode('board');
                    }}
                />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className={styles.board}>
                        <SortableContext items={displayColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                            {displayColumns.map((col) => (
                                <Column
                                    key={col.id}
                                    column={{ ...col, project }} // Pass project inside column or as separate prop? Column usage expects prop 'column'. Let's pass 'project' prop separately.
                                    project={project}
                                    onAdd={() => openModal(col.id)}
                                    onDelete={handleDeleteTask}
                                    onEdit={(task) => openModal(null, task)}
                                    onUpdateList={updateList}
                                    onDeleteList={deleteList}
                                />
                            ))}
                        </SortableContext>
                        <div className={styles.addListColumn}>
                            <button className={styles.addListBtn} onClick={() => setIsAddListModalOpen(true)}>
                                + {t('addList') || 'Add List'}
                            </button>
                        </div>
                    </div>
                    <DragOverlay>
                        {activeColumn ? (
                            <Column
                                column={activeColumn}
                                onAdd={() => { }}
                                onDelete={() => { }}
                                onEdit={() => { }}
                                onUpdateList={() => { }}
                                onDeleteList={() => { }}
                                isOverlay
                            />
                        ) : activeTask ? (
                            <TaskCard task={activeTask} />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {isAddListModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2>Add New List</h2>
                        <form onSubmit={handleAddList}>
                            <div className={styles.formGroup}>
                                <label>List Title</label>
                                <input
                                    type="text"
                                    value={newListTitle}
                                    onChange={(e) => setNewListTitle(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setIsAddListModalOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.primaryBtn}>Create List</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                task={editingTask}
                columnId={activeColumnId}
                project={project}
            />


            {/* ... */}

            {isProjectEditModalOpen && (
                <div className={styles.modalOverlay}>
                    {/* ... */}
                    <div className={styles.modal}>
                        <h2>{t('editProjectHeader')}</h2>
                        <form onSubmit={handleUpdateProject}>
                            {/* ... fields ... */}
                            <div className={styles.formGroup}>
                                <label>{t('title')}</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>{t('projectDescription')}</label>
                                <textarea
                                    className={styles.textarea}
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className={styles.dateGroup}>
                                <div className={styles.formGroup}>
                                    <label>{t('startDate')}</label>
                                    <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={e => setEditStartDate(e.target.value)}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('endDate')}</label>
                                    <input
                                        type="date"
                                        value={editEndDate}
                                        onChange={e => setEditEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '20px', padding: '15px', background: '#f4f5f7', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ margin: 0, fontWeight: 600 }}>External Integrations</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsWebhookModalOpen(true)}
                                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #dfe1e6', cursor: 'pointer', background: 'white' }}
                                    >
                                        Configure Webhooks
                                    </button>
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setIsProjectEditModalOpen(false)}>{t('cancel')}</button>
                                <button type="submit" className={styles.primaryBtn}>{t('update')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <WebhookSettingsModal
                isOpen={isWebhookModalOpen}
                onClose={() => setIsWebhookModalOpen(false)}
                project={project}
            />

            <BoardSettingsSidebar
                isOpen={isSettingsOpen}
                onClose={handleCloseSettings}
                project={project}
                onUpdateBackground={setPreviewBackground}
                onSave={handleSaveSettings}
            />

            <BulkActionBar project={project} />
        </div>
    );
}
