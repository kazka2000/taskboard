import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { useNotification } from '../context/NotificationContext';
import { NotificationDropdown } from './NotificationDropdown';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './Header.module.css';
import { useState } from 'react';

export function Header() {
    const { currentUser, setTheme, logout, language, setLanguage, t } = useProject();
    const { unreadCount } = useNotification();
    const [showNotifications, setShowNotifications] = useState(false);

    if (!currentUser) return null;

    return (
        <header className={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Link to="/" className={styles.logo}>
                    TaskBoard
                </Link>

                {/* Workspace Switcher (Using Portal) */}
                <WorkspaceSwitcher />
            </div>

            <div className={styles.actions}>
                <div className={styles.userInfo}>
                    <img src={currentUser.avatar} alt={currentUser.name} className={styles.userAvatar} />
                    <span className={styles.userName}>{currentUser.name}</span>
                    <span className={styles.userRole}>({currentUser.role})</span>
                </div>

                <div className={styles.notificationWrapper}>
                    <button
                        className={styles.notificationBtn}
                        onClick={() => setShowNotifications(!showNotifications)}
                        title="Notifications"
                    >
                        <span className={styles.bellIcon}>🔔</span>
                        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                    </button>
                    {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
                </div>

                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className={styles.langSelect}
                >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                </select>

                <div className={styles.themeToggles}>
                    <button onClick={() => setTheme('system')} className={`${styles.themeBtn} ${styles.system}`} title={t('theme.system')} />
                    <button onClick={() => setTheme('black')} className={`${styles.themeBtn} ${styles.black}`} title={t('theme.black')} />
                    <button onClick={() => setTheme('white')} className={`${styles.themeBtn} ${styles.white}`} title={t('theme.white')} />
                    <button onClick={() => setTheme('default')} className={`${styles.themeBtn} ${styles.default}`} title={t('theme.default')} />
                </div>

                {(currentUser.role === 'admin' || currentUser.role === 'team_manager') && (
                    <Link to="/admin" className={styles.adminBtn}>{t('auth.admin_panel') || 'Admin'}</Link>
                )}
                <button onClick={logout} className={`${styles.adminBtn} ${styles.logoutBtn}`}>{t('auth.logout')}</button>
            </div>
        </header>
    );
}
