import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
import { TaskModal } from '../components/TaskModal'; // Enabled
import { BoardHeader } from '../components/BoardHeader';
import { CustomFieldSettingsModal } from '../components/CustomFieldSettingsModal'; // Enabled
import { useProject } from '../context/ProjectContext';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { CalendarView } from '../components/CalendarView';
import { TimelineView } from '../components/TimelineView';
import { AISidebar } from '../components/AISidebar';

import { WebhookSettingsModal } from './WebhookSettingsModal';
import { BoardSettingsSidebar } from './BoardSettingsSidebar';
import { BulkActionBar } from './BulkActionBar';
import { ShareModal } from './ShareModal';
import styles from './Board.module.css';

import { isColorLight } from '../utils/colorUtils';
import { LayoutGrid, Calendar as CalendarIcon, BarChart2, Clock, Filter, Search, Plus, MoreHorizontal, Settings, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import axios from 'axios';

export function Board() {
    const { projectId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams(); // For deep linking

    // Safety check for context
    const projectContext = useProject();
    if (!projectContext) {
        console.error("ProjectContext is missing!");
        return <div>Error: Context missing</div>;
    }
    const { projects, updateProjectColumns, addTask, updateTask, deleteTask, users, currentUser, t, updateProject, loading, addList, updateList, deleteList, reorderLists, clearTaskSelection } = projectContext;

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

    // Deep Linking: Open Task from Query Param
    useEffect(() => {
        const taskIdToOpen = searchParams.get('openTask');
        if (taskIdToOpen && project && project.columns) {
            const taskId = parseInt(taskIdToOpen);
            // Search for task in columns
            let foundTask = null;

            for (const col of project.columns) {
                const task = col.tasks.find(t => t.id === taskId);
                if (task) {
                    foundTask = task;
                    break;
                }
            }

            if (foundTask) {
                setEditingTask(foundTask);
                setActiveColumnId(null);
                setIsTaskModalOpen(true);
            }
        }
    }, [searchParams, project]);

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
    const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [previewBackground, setPreviewBackground] = useState(null);


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
    const [sortOption, setSortOption] = useState('manual');


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
            const tasks = (col.tasks || []).filter(task => { // SAFE filtering
                // Search
                if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;

                // Assignee
                if (filterAssignee !== 'all') {
                    if (filterAssignee === 'unassigned') {
                        if (task.assignees && task.assignees.length > 0) return false;
                    } else {
                        if (!task.assignees || !task.assignees.find(u => u.id === parseInt(filterAssignee))) return false;
                    }
                }

                // Tag/Label
                if (filterTag !== 'all') {
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

    // Check if any filter is active
    const isFiltering = useMemo(() => {
        return searchTerm !== '' || filterAssignee !== 'all' || filterTag !== 'all' || filterDeadline !== 'all';
    }, [searchTerm, filterAssignee, filterTag, filterDeadline]);

    const hasResults = useMemo(() => {
        // If not filtering, we always want to show the board (even if empty)
        if (!isFiltering) return true;
        // If filtering, check if any tasks match
        return displayColumns.some(c => c.tasks.length > 0);
    }, [displayColumns, isFiltering]);


    // Handlers
    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveColumnId(active.data.current?.sortable?.containerId || null);

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
                        const taskToMove = active.data.current.task;
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
                reorderLists(project.id, newCols.map(c => c.dbId));
            }
            return;
        }

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
                // Check if it was a cross-column move that DragOver handled
                // activeTask is the snapshot from DragStart.
                const originalListId = activeTask?.list_id || activeTask?.listId;
                const currentListId = activeColumn.dbId;

                // Move Logic: 
                // 1. If list ID changed, we MUST persist.
                // 2. If Same list, persist only if index changed.

                if (originalListId && currentListId && (originalListId != currentListId)) {
                    // Cross-column move detected (already updated in state by DragOver)
                    // We need to persist this change.
                    // The task is already in the right place in 'columns' state.
                    // We just call the API.
                    // We'll trust the current position (activeIndex) as the new position.
                    const taskToUpdate = activeColumn.tasks[activeIndex];
                    updateProjectColumns(project.id, columns, taskToUpdate, activeIndex);
                } else {
                    // Same column reorder
                    if (activeIndex !== overIndex) {
                        const newTasks = arrayMove(activeColumn.tasks, activeIndex, overIndex);
                        const newCols = columns.map(c => c.id === activeColumn.id ? { ...c, tasks: newTasks } : c);
                        setColumns(newCols);
                        // Persist
                        updateProjectColumns(project.id, newCols, activeColumn.tasks[activeIndex], overIndex);
                    }
                }
            } else {
                // Different column (DragOver didn't handle it? Should be rare if DragOver works)
                // This block runs if activeColumn != overColumn at DragEnd.
                // This happens if DragOver didn't fire or didn't swap them yet?
                // Usually DragOver swaps them so we fall into 'activeColumn === overColumn' block.
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
            deleteTask(project.id, taskId);
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

    const openModal = (colId = null, task = null) => {
        if (task) {
            setEditingTask(task);
            setActiveColumnId(null);
            setIsTaskModalOpen(true);
        } else {
            setEditingTask(null);
            setActiveColumnId(colId);
            setIsTaskModalOpen(true);
        }
    };

    const handleSaveSettings = async () => {
        console.log("handleSaveSettings called", previewBackground);
        if (!previewBackground) {
            setIsSettingsOpen(false);
            return;
        }

        try {
            let finalValue = previewBackground.value;

            // If it's a file upload (we stored 'file' in preview object in Sidebar), upload now
            if (previewBackground.file) {
                console.log("Uploading file...", previewBackground.file);
                const formData = new FormData();
                formData.append('file', previewBackground.file);
                // POST to project upload endpoint
                const res = await axios.post(`http://localhost:3000/api/projects/${projectId}/background`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log("Upload response:", res.data);
                if (res.data.success) {
                    finalValue = res.data.filePath;
                }
            }

            console.log("Saving project background:", { type: previewBackground.type, value: finalValue });
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
            const url = bgValue.startsWith('data:') ? bgValue : `http://localhost:3000${bgValue}`;

            return {
                backgroundImage: `url(${url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '--project-text-color': '#ffffff',
                '--project-text-shadow': '0 2px 4px rgba(0,0,0,0.5)',
                '--board-list-bg': 'rgba(255, 255, 255, 0.2)',
                '--board-card-bg': 'rgba(255, 255, 255, 0.9)',
                '--project-icon-color': '#ffffff' // Ensure icons are white
            };
        } else {
            const color = bgValue === 'default' ? '#ffffff' : bgValue;
            if (bgValue === 'default' && !bgState.type) return {}; // Default

            const isLight = isColorLight(color);
            return {
                backgroundColor: color,
                backgroundImage: 'none',
                '--project-text-color': isLight ? '#171717' : '#ffffff',
                '--board-list-bg': isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.12)',
                '--board-card-bg': isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.95)',
                '--project-text-shadow': 'none',
                '--project-icon-color': isLight ? 'inherit' : '#ffffff'
            };
        }
    }, [project, previewBackground]);

    const isLightBg = useMemo(() => {
        if (backgroundStyle.backgroundColor) {
            return isColorLight(backgroundStyle.backgroundColor);
        }
        if (backgroundStyle.backgroundImage) return false;
        return true;
    }, [backgroundStyle]);

    // Force text color based on background
    useEffect(() => {
        const root = document.documentElement;
        if (!isLightBg) {
            root.style.setProperty('--project-text-color', '#ffffff');
            root.style.setProperty('--project-icon-color', '#ffffff');
        } else {
            root.style.removeProperty('--project-text-color');
            root.style.removeProperty('--project-icon-color');
        }
        return () => {
            root.style.removeProperty('--project-text-color');
            root.style.removeProperty('--project-icon-color');
        };
    }, [isLightBg]);

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
                    <Link to="/" className={styles.backLink}>← {t('common.back_to_dashboard')}</Link>
                    <h1>{project.title}</h1>
                    {(currentUser?.id === project.owner_id || currentUser?.role === 'admin') && (
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            <button
                                className={styles.editProjectBtn}
                                onClick={() => setIsShareModalOpen(true)}
                                title={t('common.share')}
                            >
                                <Share2 size={16} /> {t('common.share')}
                            </button>
                            <button
                                className={styles.editProjectBtn}
                                onClick={() => setIsProjectEditModalOpen(true)}
                            >
                                {t('project.edit_title')}
                            </button>
                            <button
                                className={styles.editProjectBtn}
                                onClick={() => setIsSettingsOpen(true)} // Fixed Handler
                                title={t('common.settings')}
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
                        {t('nav.board')}
                    </button>

                    <button
                        className={`${styles.viewBtn} ${viewMode === 'analytics' ? styles.activeView : ''}`}
                        onClick={() => setViewMode('analytics')}
                    >
                        {t('nav.analytics')}
                    </button>
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.activeView : ''}`}
                        onClick={() => setViewMode('calendar')}
                    >
                        {t('nav.calendar')}
                    </button>
                    <button
                        className={`${styles.viewBtn} ${viewMode === 'timeline' ? styles.activeView : ''}`}
                        onClick={() => setViewMode('timeline')}
                    >
                        {t('nav.timeline')}
                    </button>

                </div>

                {(project.description || project.start_date || project.end_date) && (
                    <div className={styles.projectInfo}>
                        {project.description && (
                            <div className={styles.descriptionSection}>
                                <span className={styles.infoLabel}>{t('project.description')}:</span>
                                <p className={styles.descriptionText}>{project.description}</p>
                            </div>
                        )}
                        {(project.start_date || project.end_date) && (
                            <div className={styles.periodSection}>
                                <span className={styles.infoLabel}>{t('project.period')}:</span>
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
                        labels={project?.labels}
                        onOpenSettings={() => setIsCustomFieldsSettingsOpen(true)}
                    />
                </div>

                <BulkActionBar project={project} />
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
            ) : viewMode === 'calendar' ? (
                <CalendarView
                    tasks={displayColumns.flatMap(col => col.tasks)}
                    onTaskClick={(task) => openModal(null, task)}
                    onTaskMove={(taskId, newDeadline) => {
                        updateTask(taskId, { deadline: newDeadline });
                    }}
                />
            ) : viewMode === 'timeline' ? (
                <TimelineView
                    tasks={displayColumns.flatMap(col => col.tasks)}
                    onTaskClick={(task) => openModal(null, task)}
                    updateTask={(taskId, updates) => updateTask(taskId, updates)}
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
                                    column={{ ...col, project }}
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
                                column={{ ...activeColumn, project }}
                                project={project}
                                isOverlay
                            />
                        ) : activeTask ? (
                            <TaskCard task={activeTask} project={project} />
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


            {isProjectEditModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2>{t('editProjectHeader')}</h2>
                        <form onSubmit={handleUpdateProject}>
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

                            <div className={styles.modalActions}>
                                <button type="button" onClick={() => setIsProjectEditModalOpen(false)}>{t('cancel')}</button>
                                <button type="submit" className={styles.primaryBtn}>{t('update')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <CustomFieldSettingsModal
                isOpen={isCustomFieldsSettingsOpen}
                onClose={() => setIsCustomFieldsSettingsOpen(false)}
                project={project}
            />


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

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                project={project}
            />

            <AISidebar />
        </div>
    );
}
