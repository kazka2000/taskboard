import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Column } from '../components/Column';
import styles from '../features/Board.module.css'; // Reuse Board styles

export function PublicBoard() {
    const { token } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const response = await axios.get(`http://localhost:3000/api/public/projects/${token}`);
                if (response.data.success) {
                    setProject(response.data.project);
                }
            } catch (err) {
                console.error('Failed to load public project:', err);
                setError('Project not found or private.');
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [token]);

    if (loading) return <div className="loading-screen">Loading...</div>;
    if (error) return <div className="error-screen">{error}</div>;
    if (!project) return null;

    // Apply background
    const bgStyle = {};
    if (project.background_type === 'color' && project.background_value) {
        if (project.background_value.startsWith('#')) {
            bgStyle.backgroundColor = project.background_value;
        } else if (project.background_value !== 'default') {
            // Map default names if needed
        }
    } else if (project.background_type === 'image') {
        bgStyle.backgroundImage = `url(http://localhost:3000${project.background_value})`;
        bgStyle.backgroundSize = 'cover';
    }

    return (
        <div className={styles.boardContainer} style={bgStyle}>
            {/* Header (Simplified) */}
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h1>{project.title} <span style={{ fontSize: '0.8em', opacity: 0.7 }}>(Read Only)</span></h1>
                </div>
            </div>

            <DndContext>
                <div className={styles.board}>
                    <SortableContext items={project.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        {project.columns.map(column => (
                            <Column
                                key={column.id}
                                column={column}
                                tasks={column.tasks}
                                readOnly={true}
                                // Empty handlers
                                updateList={() => { }}
                                deleteList={() => { }}
                                addTask={() => { }}
                                updateTask={() => { }}
                                deleteTask={() => { }}
                                onTaskClick={() => { }}
                            />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>
        </div>
    );
}
