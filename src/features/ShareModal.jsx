import React, { useState, useEffect } from 'react';
import { X, Copy, Globe, Lock } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './ShareModal.module.css';

export function ShareModal({ isOpen, onClose, project }) {
    const { shareProject } = useProject();
    const [isPublic, setIsPublic] = useState(false);
    const [publicToken, setPublicToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (project) {
            setIsPublic(project.is_public);
            setPublicToken(project.public_token);
        }
    }, [project]);

    if (!isOpen || !project) return null;

    const handleToggle = async (checked) => {
        setLoading(true);
        try {
            const data = await shareProject(project.id, checked);
            setIsPublic(data.isPublic);
            setPublicToken(data.publicToken);
        } catch (error) {
            // Error handling done in context
            setIsPublic(!checked); // Revert UI on error
        } finally {
            setLoading(false);
        }
    };

    const publicUrl = publicToken
        ? `${window.location.origin}/public/${publicToken}`
        : '';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{t('share_modal.title')} "{project.title}"</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.section}>
                        <div className={styles.toggleRow}>
                            <div className={styles.toggleInfo}>
                                <div className={styles.iconWrapper}>
                                    {isPublic ? <Globe size={24} className={styles.publicIcon} /> : <Lock size={24} />}
                                </div>
                                <div>
                                    <h3>Public Access</h3>
                                    <p>Allow anyone with the link to view this project.</p>
                                </div>
                            </div>
                            <label className={styles.switch}>
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => handleToggle(e.target.checked)}
                                    disabled={loading}
                                />
                                <span className={styles.slider}></span>
                            </label>
                        </div>
                    </div>

                    {isPublic && (
                        <div className={`${styles.linkSection} ${styles.fadeIn}`}>
                            <label>Public Link</label>
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    value={publicUrl}
                                    readOnly
                                    className={styles.linkInput}
                                />
                                <button
                                    className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
                                    onClick={copyToClipboard}
                                >
                                    {copied ? 'Copied!' : <><Copy size={16} /> Copy</>}
                                </button>
                            </div>
                            <p className={styles.helperText}>
                                Viewers can only see tasks and lists. Editing is disabled.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
