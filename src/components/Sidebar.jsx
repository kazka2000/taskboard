import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import styles from './Sidebar.module.css';
import { Plus, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MindfulMessage } from './MindfulMessage';
import { SystemHealthWidget } from './SystemHealthWidget';

export function Sidebar({ onOpenSettings }) {
    const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace, fetchProjects, t } = useProject();
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const navigate = useNavigate();

    const handleWorkspaceClick = (workspace) => {
        setCurrentWorkspace(workspace);
        fetchProjects(workspace ? workspace.id : null);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;
        await createWorkspace(newWorkspaceName);
        setNewWorkspaceName('');
        setIsCreating(false);
    };

    return (
        <div className={styles.sidebar}>


            {/* Mindful Message (Top Greeting) */}
            <MindfulMessage />
            <SystemHealthWidget />

            <div className={styles.sectionHeader}>
                <h3>{t('workspace.title')}</h3>
                <button onClick={() => setIsCreating(true)} className={styles.addButton} title={t('workspace.create_title') || t('common.create')}>
                    <Plus size={16} />
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreateSubmit} className={styles.createForm}>
                    <input
                        type="text"
                        placeholder={t('workspace.create_placeholder')}
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.formActions}>
                        <button type="submit">{t('workspace.add')}</button>
                        <button type="button" onClick={() => setIsCreating(false)}>{t('common.cancel')}</button>
                    </div>
                </form>
            )}

            <ul className={styles.workspaceList}>
                <li
                    className={!currentWorkspace ? styles.active : ''}
                    onClick={() => handleWorkspaceClick(null)}
                >
                    <span className={styles.wsName}>{t('workspace.all_projects')}</span>
                </li>
                {workspaces.map(ws => (
                    <li
                        key={ws.id}
                        className={currentWorkspace?.id === ws.id ? styles.active : ''}
                        onClick={() => handleWorkspaceClick(ws)}
                    >
                        <span className={styles.wsName}>{ws.name}</span>
                        {currentWorkspace?.id === ws.id && (
                            <button
                                className={styles.settingsButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSettings(ws);
                                }}
                            >
                                <Settings size={14} />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
