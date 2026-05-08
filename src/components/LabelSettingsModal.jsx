import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './LabelSettingsModal.module.css';

const PRESET_COLORS = [
    '#61bd4f', // Green
    '#f2d600', // Yellow
    '#ff9f1a', // Orange
    '#eb5a46', // Red
    '#c377e0', // Purple
    '#0079bf', // Blue
    '#00c2e0', // Sky
    '#51e898', // Lime
    '#ff78cb', // Pink
    '#344563'  // Dark
];

export function LabelSettingsModal({ project, onClose }) {
    const { createLabel, updateLabel, deleteLabel, t } = useProject();
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [isCreating, setIsCreating] = useState(false);
    const [pendingLabels, setPendingLabels] = useState([]);

    // Sort labels by position or id
    const sortedLabels = [...(project.labels || [])].sort((a, b) => a.position - b.position);

    const handleAddToPending = () => {
        if (!name.trim()) return;
        const newLabel = {
            id: `temp-${Date.now()}`,
            name,
            color,
            isPending: true
        };
        setPendingLabels([...pendingLabels, newLabel]);
        setName('');
        setColor(PRESET_COLORS[0]);
        // Keep creating mode open for rapid entry? Or close? User said "Add... appear in list".
        // Usually rapid entry is better.
    };

    const handleSaveAll = async () => {
        // Commit pending labels
        for (const label of pendingLabels) {
            await createLabel(project.id, label.name, label.color);
        }
        setPendingLabels([]);
        onClose();
    };

    const removePending = (id) => {
        setPendingLabels(pendingLabels.filter(l => l.id !== id));
    };

    const handleUpdate = async (id) => {
        if (!name.trim()) return;
        await updateLabel(id, name, color);
        setEditingLabelId(null);
        setName('');
        setColor(PRESET_COLORS[0]);
    };

    const startEdit = (label) => {
        setEditingLabelId(label.id);
        setName(label.name);
        setColor(label.color);
        setIsCreating(false);
    };

    const handleDelete = async (id) => {
        if (confirm(t('label.delete_confirm'))) {
            await deleteLabel(id);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>{t('label.title')}</h2>
                    <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
                </div>

                <div className={styles.content}>
                    <ul className={styles.labelList}>
                        {/* Existing Labels */}
                        {sortedLabels.map(label => (
                            <li key={label.id} className={styles.labelItem}>
                                {editingLabelId === label.id ? (
                                    <div className={styles.editForm}>
                                        <div className={styles.preview} style={{ backgroundColor: color }}>
                                            {name || t('label.title')}
                                        </div>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className={styles.input}
                                            autoFocus
                                        />
                                        <div className={styles.colorPalette}>
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    type="button"
                                                    key={c}
                                                    className={`${styles.colorBtn} ${color === c ? styles.selected : ''}`}
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => setColor(c)}
                                                />
                                            ))}
                                        </div>
                                        <div className={styles.actions}>
                                            <button type="button" onClick={() => handleUpdate(label.id)} className={styles.saveBtn}>{t('common.save')}</button>
                                            <button type="button" onClick={() => setEditingLabelId(null)} className={styles.cancelBtn}>{t('common.cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.viewMode}>
                                        <span className={styles.labelBadge} style={{ backgroundColor: label.color }}>
                                            {label.name}
                                        </span>
                                        <div className={styles.itemActions}>
                                            <button type="button" onClick={() => startEdit(label)}><Edit2 size={16} /></button>
                                            <button type="button" onClick={() => handleDelete(label.id)}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                        {/* Pending Labels */}
                        {pendingLabels.map(label => (
                            <li key={label.id} className={styles.labelItem}>
                                <div className={styles.viewMode}>
                                    <div>
                                        <span className={styles.pendingBadge}>{t('label.new_badge')}</span>
                                        <span className={styles.labelBadge} style={{ backgroundColor: label.color }}>
                                            {label.name}
                                        </span>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button type="button" onClick={() => removePending(label.id)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {isCreating ? (
                        <div className={styles.createForm}>
                            <h3>{t('label.create_title')}</h3>
                            <div className={styles.creationBox}>
                                <div className={styles.preview} style={{ backgroundColor: color }}>
                                    {name || t('label.title')}
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder={t('label.placeholder_name')}
                                    className={styles.input}
                                    autoFocus
                                />
                                <div className={styles.colorPalette}>
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            type="button"
                                            key={c}
                                            className={`${styles.colorBtn} ${color === c ? styles.selected : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className={styles.actions}>
                                <button type="button" onClick={handleAddToPending} className={styles.createBtn}>{t('label.add_pending')}</button>
                                <button type="button" onClick={() => setIsCreating(false)} className={styles.cancelBtn}>{t('common.cancel')}</button>
                            </div>
                        </div>
                    ) : (
                        !editingLabelId && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button type="button" onClick={() => setIsCreating(true)} className={styles.addBtn}>
                                    <Plus size={16} /> {t('label.create')}
                                </button>
                                <button type="button" onClick={handleSaveAll} className={styles.saveBtn} style={{ marginTop: '1rem' }}>
                                    {t('label.save_changes')}
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
