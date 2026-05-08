import React, { useState } from 'react';
import { X, Image as ImageIcon, Upload } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { AutomationSettings } from './AutomationSettings';
import styles from './BoardSettingsSidebar.module.css';

export function BoardSettingsSidebar({ isOpen, onClose, project, onUpdateBackground, onSave }) {
    const { t, uploadAttachment } = useProject();
    const [activeTab, setActiveTab] = useState('color'); // 'color' | 'photo'
    const [uploading, setUploading] = useState(false);

    if (!isOpen) return null;

    const colors = [
        '#0079bf', '#d29034', '#519839', '#b04632', '#89609e', '#cd5a91', '#4bbf6b', '#00aecc', '#838c91', '#172b4d'
    ];

    const handleColorSelect = (color) => {
        onUpdateBackground({ type: 'color', value: color });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        console.log("File selected:", file);
        if (!file) return;

        // Reset value to allow re-selecting the same file
        e.target.value = '';

        setUploading(true);
        try {
            // Use a specific upload function for project background if available, 
            // or use a generic one. For now, we will simulate or use a temporary approach 
            // until the API is fully confirmed. 
            // Actually, we should implementation the upload in Context.
            // Let's assume onUpload is passed or we use a helper.
            // We'll use a placeholder logic that calls the API we WILL add shortly.

            // We need to upload immediately to preview it.
            // Let's implement `uploadProjectBackground` in Context or here via fetch.
            // For now, let's call a prop or context method.
            if (project && project.id) {
                // We need a way to upload without attaching to a task? 
                // Or we reuse the task attachment API? No, cleaner to have project endpoint.
                // We will implement `uploadProjectBackground` in Context.
                // We need to add this to Context export

                // If not exposed, we can use direct axios for now or props.
                // Let's rely on `uploadProjectFile` which I'll add to Context.
                // Wait, I can't use destructuring if it's not there yet.
                // I'll grab context object.
            }
            // TEMPORARY: Read as DataURL for immediate preview (no server upload yet)
            // THEN upload on save? Or upload immediately? 
            // Usually upload immediately to get URL, then save URL on "Save".

            // Let's use DataURL for preview if we want to avoid server junk, 
            // BUT implementation plan said "Upload Image -> Image uploaded".
            // So we should upload.

            // For this step, I'll pass the file to parent or handle it.
            // Let's just read as DataURL for PREVIEW to be fast, 
            // and actually upload when "Save" is clicked? 
            // Or upload now to get a temp URL?
            // "Real-time preview".

            const reader = new FileReader();
            reader.onload = (ev) => {
                console.log("File loaded as DataURL", ev.target.result?.substring(0, 50) + "...");
                onUpdateBackground({ type: 'image', value: ev.target.result, file: file });
                // We pass the raw file too so Board can upload it on Save?
                // Or we upload here.
            };
            reader.readAsDataURL(file);

        } catch (error) {
            console.error("File processing error", error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={styles.sidebarOverlay} onClick={onClose}>
            <div className={styles.sidebar} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>{t('board_settings.title')}</h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'color' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('color')}
                    >
                        {t('board_settings.color')}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'photo' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('photo')}
                    >
                        {t('board_settings.photo')}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'export' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('export')}
                    >
                        {t('board_settings.export')}
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'automation' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('automation')}
                    >
                        {t('board_settings.automation')}
                    </button>
                </div>

                <div className={styles.content}>
                    {activeTab === 'automation' && (
                        <AutomationSettings project={project} />
                    )}
                    {activeTab === 'color' && (
                        <div className={styles.colorGrid}>
                            {colors.map(c => (
                                <button
                                    key={c}
                                    className={styles.colorBox}
                                    style={{ backgroundColor: c }}
                                    onClick={() => handleColorSelect(c)}
                                    aria-label={`Select color ${c}`}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'photo' && (
                        <div className={styles.photoSection}>
                            <label className={styles.uploadBtn}>
                                <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
                                <Upload size={16} />
                                {uploading ? t('board_settings.uploading') : t('board_settings.upload_image')}
                            </label>

                            <div className={styles.photosGrid}>
                                {/* Preset photos could go here */}
                                <div className={styles.photoPlaceholder}>
                                    <ImageIcon size={24} />
                                    <span>{t('board_settings.no_recent_photos')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'export' && (
                        <div className={styles.exportSection}>
                            <h3>{t('board_settings.export_data')}</h3>
                            <button
                                className={styles.exportBtn}
                                onClick={() => window.location.href = `http://localhost:3000/api/projects/${project.id}/export/csv`}
                            >
                                {t('board_settings.export_csv')}
                            </button>
                            <button
                                className={styles.exportBtn}
                                onClick={() => window.location.href = `http://localhost:3000/api/projects/${project.id}/export/pdf`}
                            >
                                {t('board_settings.export_pdf')}
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button className={styles.saveBtn} onClick={onSave}>
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
