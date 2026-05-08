import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { useProject } from '../context/ProjectContext';
import styles from './NotificationDropdown.module.css';

export function NotificationDropdown({ onClose }) {
    const { notifications, markAsRead, markAllAsRead } = useNotification();
    const { t } = useProject();

    const getMessage = (notification) => {
        try {
            // Attempt to parse JSON for new code-based notifications
            const data = JSON.parse(notification.message);
            // Check if it matches our expected structure { code, params }
            if (data && data.code) {
                return t(data.code, data.params || {});
            }
        } catch (e) {
            // Not JSON, fall back to raw text (backward compatibility)
        }
        return notification.message;
    };

    if (notifications.length === 0) {
        return (
            <div className={styles.dropdown}>
                <div className={styles.header}>
                    <h3>{t('notification.title')}</h3>
                    <button onClick={onClose} className={styles.closeBtn}>&times;</button>
                </div>
                <div className={styles.empty}>
                    {t('notification.empty') || 'No new notifications.'}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dropdown}>
            <div className={styles.header}>
                <h3>{t('notification.title')}</h3>
                <div className={styles.actions}>
                    <button onClick={markAllAsRead} className={styles.markAllBtn}>
                        {t('notification.mark_all_read') || 'Read All'}
                    </button>
                    <button onClick={onClose} className={styles.closeBtn}>&times;</button>
                </div>
            </div>
            <ul className={styles.list}>
                {notifications.map(n => (
                    <li key={n.id} className={`${styles.item} ${n.is_read ? styles.read : styles.unread}`} onClick={() => markAsRead(n.id)}>
                        <div className={styles.message}>{getMessage(n)}</div>
                        <div className={styles.time}>{new Date(n.created_at).toLocaleString()}</div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
