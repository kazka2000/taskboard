import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import styles from './AcceptInvite.module.css';

export function AcceptInvite() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [isValidating, setIsValidating] = useState(true);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            try {
                const res = await axios.get(`http://localhost:3000/api/invite/${token}`);
                if (res.data.success) {
                    setEmail(res.data.email);
                } else {
                    setError('Invalid or expired invitation link.');
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to validate invitation.');
            } finally {
                setValidating(false);
            }
        };

        // typo fix
        const setValidating = (val) => setIsValidating(val);
        validateToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !password) return;

        setIsSubmitting(true);
        try {
            const res = await axios.post('http://localhost:3000/api/invite/accept', {
                token,
                name,
                password
            });
            if (res.data.success) {
                setSuccess(true);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isValidating) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h2>Validating Invitation...</h2>
                </div>
            </div>
        );
    }

    if (error && !success) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h2 className={styles.errorText}>Oops!</h2>
                    <p>{error}</p>
                    <Link to="/login" className={styles.linkBtn}>Go to Login</Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.card}>
                    <h2 className={styles.messageText}>Welcome to TaskBoard!</h2>
                    <p>Your account has been created successfully.</p>
                    <Link to="/login" className={styles.linkBtn}>Proceed to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.logo}>📋 TaskBoard</h1>
                <h2 className={styles.title}>Accept Invitation</h2>
                <p className={styles.desc}>Complete your profile for <strong>{email}</strong></p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Full Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
