import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import styles from './Login.module.css';

export function Login() {
    const { login, t } = useProject();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
            navigate('/'); // Redirect to dashboard after login
        } catch (err) {
            setError(err.message || t('loginFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1>{t('loginTitle')}</h1>
                <form onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="username">{t('username')}</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('enterUsername')}
                            required
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label htmlFor="password">{t('password')}</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('enterPassword')}
                            required
                        />
                    </div>
                    {error && <div className={styles.error}>{error}</div>}
                    <button type="submit" className={styles.loginBtn} disabled={isLoading}>
                        {isLoading ? t('loggingIn') : t('loginBtn')}
                    </button>
                </form>
            </div>
        </div>
    );
}
