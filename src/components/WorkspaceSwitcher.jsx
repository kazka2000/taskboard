import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './Header.module.css'; // Reusing Header styles for consistency

export function WorkspaceSwitcher() {
    const { workspaces, currentWorkspace, setCurrentWorkspace, fetchProjects, t } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const toggleMenu = () => {
        if (!isOpen) {
            // Calculate position before opening
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.bottom + 8, // 8px offset
                    left: rect.left
                });
            }
        }
        setIsOpen(!isOpen);
    };

    const handleSwitchWorkspace = (workspace) => {
        setCurrentWorkspace(workspace);
        fetchProjects(workspace ? workspace.id : null);
        setIsOpen(false);
        navigate('/');
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        // Also update position on scroll/resize if open
        function handleResize() {
            if (isOpen && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setPosition({ top: rect.bottom + 8, left: rect.left });
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("resize", handleResize);
        window.addEventListener("scroll", handleResize, true);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("scroll", handleResize, true);
        };
    }, [isOpen]);

    return (
        <div className={styles.workspaceSwitcher}>
            <button
                ref={buttonRef}
                className={styles.wsButton}
                onClick={toggleMenu}
                title={t('workspace.switch') || 'Switch Workspace'}
            >
                {currentWorkspace ? currentWorkspace.name : t('workspace.all_projects')}
                <ChevronDown size={14} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className={styles.wsDropdown}
                    style={{
                        position: 'fixed', // Portal needs fixed positioning
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                        // Reuse existing styles but override positioning context
                        marginTop: 0,
                        zIndex: 99999
                    }}
                >
                    <div className={styles.wsLabel}>{t('workspace.current') || 'Current Workspace'}</div>
                    {workspaces.map(ws => (
                        <div
                            key={ws.id}
                            className={`${styles.wsItem} ${currentWorkspace?.id === ws.id ? styles.wsItemActive : ''}`}
                            onClick={() => handleSwitchWorkspace(ws)}
                        >
                            <span>{ws.name}</span>
                            {currentWorkspace?.id === ws.id && <Check size={14} />}
                        </div>
                    ))}
                    <div className={styles.wsLabel} style={{ marginTop: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '4px' }}>Options</div>
                    <div
                        className={`${styles.wsItem} ${!currentWorkspace ? styles.wsItemActive : ''}`}
                        onClick={() => handleSwitchWorkspace(null)}
                    >
                        <span>{t('workspace.all_projects')}</span>
                        {!currentWorkspace && <Check size={14} />}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
