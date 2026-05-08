import React, { useState, useRef, useLayoutEffect } from 'react';
import { Plus, Check, Tag, Search } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './LabelSelector.module.css';
import { LabelSettingsModal } from './LabelSettingsModal';

export function LabelSelector({ projectId, selectedLabelIds, onChange }) {
    const { projects, t } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPos, setDropdownPos] = useState('top'); // Default to top
    const containerRef = useRef(null);

    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = 300; // Approx max height

            // Prefer Top (Upward), unless space is tight and bottom has more space
            if (spaceAbove < dropdownHeight && spaceBelow > spaceAbove) {
                setDropdownPos('bottom');
            } else {
                setDropdownPos('top');
            }
        }
    }, [isOpen]);

    const project = projects.find(p => p.id === projectId);
    if (!project) return null;

    const labels = project.labels || [];
    const filteredLabels = labels.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const toggleLabel = (labelId) => {
        let newIds;
        if (selectedLabelIds.includes(labelId)) {
            newIds = selectedLabelIds.filter(id => id !== labelId);
        } else {
            newIds = [...selectedLabelIds, labelId];
        }
        onChange(newIds);
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <div
                className={styles.triggerBtn}
                onClick={() => setIsOpen(!isOpen)}
                title={t('label.manage')}
            >
                {selectedLabelIds.length === 0 ? (
                    <span className={styles.placeholder}>
                        <Plus size={16} />
                        {t('label.placeholder_select') || t('label.empty_text')}
                    </span>
                ) : (
                    <>
                        {selectedLabelIds.map(id => {
                            const label = labels.find(l => l.id === id);
                            if (!label) return null;
                            return (
                                <div
                                    key={label.id}
                                    className={styles.chip}
                                    style={{ backgroundColor: label.color }}
                                    onClick={(e) => { e.stopPropagation(); toggleLabel(label.id); }} // Allow removing by clicking chip? User requested X button.
                                >
                                    {label.name}
                                    <button
                                        type="button"
                                        className={styles.removeChipBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleLabel(label.id);
                                        }}
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                        <button type="button" className={styles.addMoreBtn} onClick={(e) => {
                            e.stopPropagation(); // Just open dropdown, button click handled by parent trigger if not stopped?
                            // wait, parent click opens dropdown.
                            // if I click addMoreBtn, bubbles to parent -> open.
                            setIsOpen(true);
                        }}>
                            <Plus size={14} />
                            {t('common.add') || 'Add'}
                        </button>
                    </>
                )}
            </div>

            {isOpen && (
                <>
                    <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
                    <div className={`${styles.dropdown} ${dropdownPos === 'top' ? styles.dropdownUp : ''}`}>
                        <div className={styles.header}>
                            <span>{t('label.title')}</span>
                            <button type="button" onClick={() => setShowSettings(true)} className={styles.editBtn}>
                                {t('label.edit')}
                            </button>
                        </div>
                        <div className={styles.searchContainer}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder={t('label.search_placeholder')}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className={styles.search}
                                autoFocus
                            />
                        </div>
                        <div className={styles.list}>
                            {filteredLabels.map(label => {
                                const isSelected = selectedLabelIds.includes(label.id);
                                return (
                                    <div
                                        key={label.id}
                                        className={styles.item}
                                        onClick={() => toggleLabel(label.id)}
                                    >
                                        <div
                                            className={styles.preview}
                                            style={{ backgroundColor: label.color }}
                                        >
                                            {label.name}
                                            {isSelected && <Check size={14} className={styles.check} />}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredLabels.length === 0 && (
                                <div className={styles.empty}>{t('label.no_results')}</div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {showSettings && (
                <LabelSettingsModal
                    project={project}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}
