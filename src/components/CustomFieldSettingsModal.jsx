import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import styles from './CustomFieldSettingsModal.module.css';

export function CustomFieldSettingsModal({ isOpen, onClose, project }) {
    const { createCustomField, deleteCustomField, t } = useProject();
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState('text');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    if (!isOpen || !project) return null;

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newFieldName.trim()) return;

        await createCustomField(project.id, newFieldName, newFieldType, project.customFields ? project.customFields.length : 0);
        setNewFieldName('');
        setNewFieldType('text');
    };

    const handleDeleteClick = (e, fieldId) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDeleteId(fieldId);
    };

    const confirmDelete = async (e, fieldId) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteCustomField(fieldId);
        setConfirmDeleteId(null);
    };

    const cancelDelete = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDeleteId(null);
    };

    // Safely access customFields
    const fields = project.customFields || [];

    return (
        <div className={styles.modalOverlay} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>{t('custom_field.manage')}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.fieldList}>
                        <h3>{t('custom_field.existing')}</h3>
                        {fields.length === 0 ? (
                            <p className={styles.emptyState}>{t('custom_field.none')}</p>
                        ) : (
                            <ul>
                                {fields.map(field => (
                                    <li key={field.id} className={styles.fieldItem}>
                                        <div className={styles.fieldInfo}>
                                            <span className={styles.fieldName}>{field.name}</span>
                                            <span className={styles.fieldType}>({t(`custom_field.type_${field.type}`.toLowerCase()) || field.type})</span>
                                        </div>

                                        {confirmDeleteId === field.id ? (
                                            <div className={styles.confirmActions}>
                                                <span className={styles.confirmText}>{t('common.delete')}?</span>
                                                <button
                                                    type="button"
                                                    className={styles.yesBtn}
                                                    onClick={(e) => confirmDelete(e, field.id)}
                                                >
                                                    {t('common.confirm')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.noBtn}
                                                    onClick={cancelDelete}
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.deleteBtn}
                                                onClick={(e) => handleDeleteClick(e, field.id)}
                                            >
                                                {t('common.delete')}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <form onSubmit={handleCreate} className={styles.createForm}>
                        <h3>{t('custom_field.add_new')}</h3>
                        <div className={styles.formGroup}>
                            <input
                                type="text"
                                value={newFieldName}
                                onChange={(e) => setNewFieldName(e.target.value)}
                                placeholder={t('custom_field.name_placeholder')}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <select
                                value={newFieldType}
                                onChange={(e) => setNewFieldType(e.target.value)}
                            >
                                <option value="text">{t('custom_field.type_text')}</option>
                                <option value="number">{t('custom_field.type_number')}</option>
                                <option value="checkbox">{t('custom_field.type_checkbox')}</option>
                                <option value="date">{t('custom_field.type_date')}</option>
                            </select>
                        </div>
                        <button type="submit" className={styles.addBtn}>{t('custom_field.add_action')}</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
