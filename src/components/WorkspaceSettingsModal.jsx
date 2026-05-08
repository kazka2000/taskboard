import React, { useState } from 'react';
import styles from './WorkspaceSettingsModal.module.css';
import { X, UserPlus, Trash2, AlertTriangle } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import axios from 'axios';

export function WorkspaceSettingsModal({ workspace, onClose }) {
    const { currentUser, deleteWorkspace, t } = useProject();
    const [inviteEmail, setInviteEmail] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        try {
            // Placeholder for API call
            const response = await axios.post(`http://localhost:3000/api/workspaces/${workspace.id}/members`, {
                identifier: inviteEmail // email or username
            });
            if (response.data.success) {
                alert(t('common.success'));
                setInviteEmail('');
            }
        } catch (e) {
            alert(t('common.error') + ': ' + (e.response?.data?.message || e.message));
        }
    };

    const handleDelete = async () => {
        try {
            await deleteWorkspace(workspace.id);
            onClose(); // Close modal
        } catch (e) {
            alert(t('common.error'));
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>{t('workspace_settings.title', { name: workspace.name })}</h2>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>
                <div className={styles.modalBody}>
                    <h3 className={styles.sectionTitle}>
                        <UserPlus size={18} />
                        {t('workspace_settings.invite_members')}
                    </h3>
                    <form onSubmit={handleInvite} className={styles.inviteForm}>
                        <input
                            type="text"
                            placeholder={t('workspace_settings.invite_placeholder')}
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            className={styles.input}
                        />
                        <button type="submit" className={styles.inviteBtn}>
                            {t('workspace_settings.invite_action')}
                        </button>
                    </form>

                    {/* Danger Zone */}
                    <div className={styles.dangerZone}>
                        <button
                            className={styles.deleteBtn}
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 size={16} />
                            {t('workspace_settings.delete')}
                        </button>
                    </div>
                </div>

                {/* Confirmation Overlay */}
                {showDeleteConfirm && (
                    <div className={styles.confirmOverlay} onClick={() => setShowDeleteConfirm(false)}>
                        <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
                            <div className={styles.confirmTitle}>
                                <AlertTriangle size={24} style={{ marginBottom: 8 }} />
                                <div>{t('workspace_settings.delete_confirm_title')}</div>
                            </div>
                            <p className={styles.confirmMsg}>
                                {t('workspace_settings.delete_confirm_msg')}
                            </p>
                            <div className={styles.confirmActions}>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setShowDeleteConfirm(false)}
                                >
                                    {t('workspace_settings.delete_cancel_btn')}
                                </button>
                                <button
                                    className={styles.confirmDeleteBtn}
                                    onClick={handleDelete}
                                >
                                    {t('workspace_settings.delete_confirm_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
