import React from 'react';
import { Search, Filter, ArrowUpDown, Calendar, Settings } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './BoardHeader.module.css';

export function BoardHeader({
    searchTerm,
    onSearchChange,
    filterAssignee,
    onFilterAssigneeChange,
    filterTag,
    onFilterTagChange,
    filterDeadline,
    onFilterDeadlineChange,
    sortOption,
    onSortChange,

    users,
    labels, // New Prop
    onOpenSettings // New Prop
}) {
    const { t } = useProject();

    return (
        <div className={styles.boardHeader}>
            <div className={styles.searchContainer}>
                <Search size={18} className={styles.searchIcon} />
                <input
                    type="text"
                    placeholder={t('common.search') || 'Search tasks...'}
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            <div className={styles.controlsContainer}>
                {/* Assignee Filter */}
                <div className={styles.controlGroup}>
                    <label className={styles.label}>
                        <Filter size={14} />
                        {t('filter.assignee')}
                    </label>
                    <select
                        value={filterAssignee}
                        onChange={(e) => onFilterAssigneeChange(e.target.value)}
                        className={styles.select}
                    >
                        <option value="all">{t('common.all')}</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Label Filter */}
                <div className={styles.controlGroup}>
                    <label className={styles.label}>
                        <Filter size={14} />
                        {t('filter.label')}
                    </label>
                    <select
                        value={filterTag}
                        onChange={(e) => onFilterTagChange(e.target.value)}
                        className={styles.select}
                    >
                        <option value="all">{t('common.all')}</option>
                        {labels && labels.map(label => (
                            <option key={label.id} value={label.id}>
                                {label.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Deadline Filter */}
                <div className={styles.controlGroup}>
                    <label className={styles.label}>
                        <Calendar size={14} />
                        {t('filter.deadline')}
                    </label>
                    <select
                        value={filterDeadline}
                        onChange={(e) => onFilterDeadlineChange(e.target.value)}
                        className={styles.select}
                    >
                        <option value="all">{t('common.all')}</option>
                        <option value="today">{t('filter.deadline_today')}</option>
                        <option value="week">{t('filter.deadline_week')}</option>
                    </select>
                </div>

                {/* Sort */}
                <div className={styles.controlGroup}>
                    <label className={styles.label}>
                        <ArrowUpDown size={14} />
                        {t('filter.sort_by')}
                    </label>
                    <select
                        value={sortOption}
                        onChange={(e) => onSortChange(e.target.value)}
                        className={styles.select}
                    >

                        <option value="position">{t('filter.sort_default')}</option>
                        <option value="deadline">{t('filter.sort_date')}</option>
                        <option value="created">{t('filter.sort_created')}</option>
                        <option value="title">{t('filter.sort_title')}</option>
                    </select>
                </div>

                {/* Custom Fields Settings */}
                <button
                    className={styles.settingsBtn}
                    onClick={onOpenSettings}
                    title={t('custom_field.manage')}
                >
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
}
