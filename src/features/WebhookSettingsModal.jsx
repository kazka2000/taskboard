import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useProject } from '../context/ProjectContext';
import { X, Eye, EyeOff, Send, Check, Hash, MessageSquare, Users } from 'lucide-react';
import styles from './WebhookSettingsModal.module.css';

const platforms = [
    { id: 'slack', name: 'Slack', icon: Hash, color: '#4A154B', guideKey: 'slackGuide' },
    { id: 'discord', name: 'Discord', icon: MessageSquare, color: '#5865F2', guideKey: 'discordGuide' },
    { id: 'teams', name: 'Microsoft Teams', icon: Users, color: '#6264A7', guideKey: 'teamsGuide' }
];

export function WebhookSettingsModal({ isOpen, onClose, project }) {
    const { currentUser, showToast, t } = useProject(); // t from context
    const [webhooks, setWebhooks] = useState([]);
    const [inputs, setInputs] = useState({ slack: '', discord: '', teams: '' });
    const [showUrl, setShowUrl] = useState({ slack: false, discord: false, teams: false });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && project) {
            fetchWebhooks();
        }
    }, [isOpen, project]);

    const fetchWebhooks = async () => {
        try {
            const response = await axios.get(`http://localhost:3000/api/projects/${project.id}/webhooks?userId=${currentUser.id}`);
            if (response.data.success) {
                setWebhooks(response.data.webhooks);
                // Pre-fill inputs
                const newInputs = { slack: '', discord: '', teams: '' };
                response.data.webhooks.forEach(hook => {
                    const key = hook.platform_name.toLowerCase().includes('slack') ? 'slack' :
                        hook.platform_name.toLowerCase().includes('discord') ? 'discord' : 'teams';
                    newInputs[key] = hook.webhook_url;
                });
                setInputs(newInputs);
            }
        } catch (error) {
            console.error('Failed to fetch webhooks', error);
        }
    };

    const handleSave = async (platformId) => {
        setLoading(true);
        const url = inputs[platformId];
        // Find existing
        const existing = webhooks.find(w => w.platform_name.toLowerCase().includes(platformId));

        try {
            if (existing) {
                if (!url) {
                    // Delete if empty? Or just clear? User might want to delete.
                    await axios.delete(`http://localhost:3000/api/webhooks/${existing.id}`, { data: { userId: currentUser.id } });
                    showToast(`${platforms.find(p => p.id === platformId).name} Webhook removed`, 'success');
                } else {
                    await axios.put(`http://localhost:3000/api/webhooks/${existing.id}`, {
                        userId: currentUser.id,
                        webhook_url: url,
                        is_active: true
                    });
                    showToast('Webhook updated', 'success');
                }
            } else {
                if (url) {
                    await axios.post(`http://localhost:3000/api/projects/${project.id}/webhooks`, {
                        userId: currentUser.id,
                        platform_name: platforms.find(p => p.id === platformId).name,
                        webhook_url: url
                    });
                    showToast('Webhook added', 'success');
                }
            }
            fetchWebhooks();
        } catch (error) {
            console.error(error);
            showToast('Failed to save webhook', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async (platformId) => {
        const url = inputs[platformId];
        if (!url) return;
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:3000/api/webhooks/test', {
                url,
                platform: platformId
            });
            if (response.data.success) {
                showToast('Test message sent!', 'success');
            } else {
                showToast('Test failed', 'error');
            }
        } catch (error) {
            showToast('Test failed: Invalid URL', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>External Integrations</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className={styles.body}>
                    {platforms.map(platform => (
                        <div key={platform.id} className={styles.platformRow}>
                            <div className={styles.label} style={{ color: platform.color }}>
                                <platform.icon size={20} />
                                <span>{platform.name}</span>
                            </div>
                            <div className={styles.inputGroup}>
                                <input
                                    type={showUrl[platform.id] ? 'text' : 'password'}
                                    placeholder={`Enter ${platform.name} Webhook URL`}
                                    value={inputs[platform.id]}
                                    onChange={(e) => setInputs({ ...inputs, [platform.id]: e.target.value })}
                                />
                                <button className={styles.iconBtn} onClick={() => setShowUrl({ ...showUrl, [platform.id]: !showUrl[platform.id] })}>
                                    {showUrl[platform.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.testBtn} onClick={() => handleTest(platform.id)} disabled={!inputs[platform.id]}>
                                    <Send size={14} /> Test
                                </button>
                                <button className={styles.saveBtn} onClick={() => handleSave(platform.id)}>
                                    <Check size={14} /> Save
                                </button>
                            </div>
                            <div className={styles.guide}>
                                <small>
                                    {platform.id === 'slack' && "Slack Incoming Webhook URL"}
                                    {platform.id === 'discord' && "Discord Webhook URL"}
                                    {platform.id === 'teams' && "Microsoft Teams Incoming Webhook"}
                                </small>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
