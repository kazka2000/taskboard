import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import styles from './Dashboard.module.css';
import { Sidebar } from '../components/Sidebar';
import { WorkspaceSettingsModal } from '../components/WorkspaceSettingsModal';
import { InsightSummary } from '../components/InsightSummary';
import { SystemLogViewer } from '../components/SystemLogViewer';

import { AISidebar } from '../components/AISidebar';

export function Dashboard() {
    const { projects, addProject, deleteProject, currentUser, loading, setTheme, logout, t } = useProject();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProjectTitle, setNewProjectTitle] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [newProjectStartDate, setNewProjectStartDate] = useState('');
    const [newProjectEndDate, setNewProjectEndDate] = useState('');
    const [newProjectCategory, setNewProjectCategory] = useState('general');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsWorkspace, setSettingsWorkspace] = useState(null);

    const handleOpenSettings = (workspace) => {
        setSettingsWorkspace(workspace);
        setIsSettingsOpen(true);
    };

    if (loading) {
        return <div className={styles.loading}>{t('loading')}</div>;
    }

    const myTasks = projects.flatMap(p =>
        p.columns.flatMap(c =>
            c.tasks
                .filter(t => {
                    const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
                    return assignees.some(id => String(id) === String(currentUser?.id));
                })
                .map(t => ({
                    ...t,
                    projectName: p.title,
                    projectId: p.id
                }))
        )
    ).sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    }).slice(0, 10);

    const handleCreate = (e) => {
        e.preventDefault();
        if (newProjectTitle.trim()) {
            addProject(newProjectTitle, newProjectDescription, newProjectStartDate, newProjectEndDate, newProjectCategory);
            setNewProjectTitle('');
            setNewProjectDescription('');
            setNewProjectStartDate('');
            setNewProjectEndDate('');
            setNewProjectCategory('general');
            setIsModalOpen(false);
        }
    };

    return (
        <div className={styles.dashboardWrapper}>
            <Sidebar onOpenSettings={handleOpenSettings} />
            <AISidebar />
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>{t('dashboard.title')}</h1>
                    <div className={styles.actions}>
                        <button className={styles.createBtn} onClick={() => setIsModalOpen(true)}>
                            {t('dashboard.new_project')}
                        </button>
                        {/* Admin and Logout moved to Global Header */}
                    </div>
                </div>

                {/* Insight Summary Section */}
                {projects.length > 0 && (
                    <InsightSummary projects={projects} />
                )}

                <div className={styles.upcomingSection}>
                    <h2>{t('dashboard.my_upcoming_tasks')}</h2>
                    <div className={styles.taskList}>
                        {myTasks.length > 0 ? (
                            myTasks.map(task => (
                                <div key={task.id} className={styles.taskItem}>
                                    <div className={styles.taskHeader}>
                                        <Link to={`/project/${task.projectId}`} className={styles.taskTitle}>{task.title}</Link>
                                        <span className={`${styles.taskTag} ${styles[task.tag?.toLowerCase()] || styles.general}`}>
                                            {task.tag}
                                        </span>
                                    </div>
                                    <div className={styles.taskMeta}>
                                        <span>{t('task.project_name', { name: task.projectName }) || `${t('project.title')}: ${task.projectName}`}</span>
                                        <span>{t('task.due_date')}: {task.deadline ? new Date(task.deadline).toLocaleDateString('fr-CA') : t('task.no_deadline')}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className={styles.emptyMsg}>{t('dashboard.no_tasks')}</p>
                        )}
                    </div>
                </div>

                <h2 className={styles.sectionTitle}>{t('dashboard.project_list')}</h2>

                <div className={styles.grid}>
                    {projects.length > 0 ? (
                        projects.map(project => (
                            <div key={project.id} className={styles.card}>
                                <Link to={`/project/${project.id}`} className={styles.cardLink}>
                                    <h2>{project.title}</h2>
                                    <div className={styles.meta}>
                                        <span>{t('project.members')}: {project.members.length}{t('common.person_unit') || '명'}</span>
                                    </div>
                                </Link>
                                {currentUser.role === 'admin' && (
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (confirm(t('project.delete_confirm'))) deleteProject(project.id);
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            <p>{t('dashboard.no_projects')}</p>
                            <button className={styles.createBtn} onClick={() => setIsModalOpen(true)}>
                                {t('dashboard.new_project')}
                            </button>
                        </div>
                    )}
                </div>

                {isModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h2>{t('project.create_title')}</h2>
                            <form onSubmit={handleCreate}>
                                <div className={styles.formGroup}>
                                    <label>{t('task.title')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('project.name_placeholder')}
                                        value={newProjectTitle}
                                        onChange={e => setNewProjectTitle(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('task.description')}</label>
                                    <textarea
                                        className={styles.textarea}
                                        placeholder={t('project.desc_placeholder')}
                                        value={newProjectDescription}
                                        onChange={e => setNewProjectDescription(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('category.label')}</label>
                                    <select
                                        className={styles.select}
                                        value={newProjectCategory}
                                        onChange={e => setNewProjectCategory(e.target.value)}
                                    >
                                        <option value="general">{t('category.general')}</option>
                                        <option value="web_dev">{t('category.web_dev')}</option>
                                        <option value="sales">{t('category.sales')}</option>
                                    </select>
                                </div>
                                <div className={styles.dateGroup}>
                                    <div className={styles.formGroup}>
                                        <label>{t('project.start_date')}</label>
                                        <input
                                            type="date"
                                            value={newProjectStartDate}
                                            onChange={e => setNewProjectStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{t('project.end_date')}</label>
                                        <input
                                            type="date"
                                            value={newProjectEndDate}
                                            onChange={e => setNewProjectEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
                                    <button type="submit" className={styles.primaryBtn}>{t('common.create')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {isSettingsOpen && settingsWorkspace && (
                <WorkspaceSettingsModal
                    workspace={settingsWorkspace}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}
        </div>
    );
}
