import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { useNavigate } from 'react-router-dom';
import widgetStyles from './SystemHealthWidget.module.css';
import { Activity, AlertTriangle, ExternalLink } from 'lucide-react';

export function SystemHealthWidget() {
    const { socket, t } = useProject();
    const navigate = useNavigate();

    // State: Map of serverName -> { status, cpu, memory, relatedTaskId, relatedProjectId }
    const [servers, setServers] = useState({});

    useEffect(() => {
        if (!socket) return;

        const handleStatus = (data) => {
            setServers(prev => ({
                ...prev,
                [data.serverName || 'Primary']: {
                    status: data.status || 'OK',
                    cpu: data.cpu || 0,
                    memory: data.memory || 0,
                    relatedTaskId: data.relatedTaskId,
                    relatedProjectId: data.relatedProjectId,
                    lastUpdate: new Date()
                }
            }));
        };

        socket.on('system:status', handleStatus);

        return () => {
            socket.off('system:status', handleStatus);
        };
    }, [socket]);

    const getStatusColor = (s) => {
        switch (s) {
            case 'Critical': return '#eb5a46';
            case 'Warning': return '#f2d600';
            default: return '#61bd4f';
        }
    };

    const handleShortcut = (serverName, data) => {
        if (data.status === 'Critical' && data.relatedTaskId && data.relatedProjectId) {
            navigate(`/project/${data.relatedProjectId}?openTask=${data.relatedTaskId}`);
        }
    };

    const serverList = Object.entries(servers).sort((a, b) => a[0].localeCompare(b[0]));

    if (serverList.length === 0) return null; // Or render placeholder

    return (
        <div className={widgetStyles.container}>
            <div className={widgetStyles.header}>
                <div className={widgetStyles.title}>
                    <Activity size={16} />
                    <span>{t('system.health_title') || 'System Health'}</span>
                </div>
            </div>

            <div className={widgetStyles.serverList}>
                {serverList.map(([name, data]) => (
                    <div
                        key={name}
                        className={`${widgetStyles.serverItem} ${data.status === 'Critical' ? widgetStyles.criticalAcc : ''}`}
                        onClick={() => handleShortcut(name, data)}
                        title={data.status === 'Critical' ? t('system.navigate_alert') : ''}
                        style={{ cursor: (data.status === 'Critical' && data.relatedTaskId) ? 'pointer' : 'default' }}
                    >
                        <div className={widgetStyles.serverHeader}>
                            <span className={widgetStyles.serverName}>{name}</span>
                            <div className={widgetStyles.statusBadge} style={{ color: getStatusColor(data.status) }}>
                                <div className={widgetStyles.dot} style={{ backgroundColor: getStatusColor(data.status) }} />
                                {data.status === 'Critical' && data.relatedTaskId && <ExternalLink size={12} />}
                            </div>
                        </div>

                        <div className={widgetStyles.miniMetrics}>
                            <div className={widgetStyles.miniBar}>
                                <span className={widgetStyles.miniLabel}>CPU</span>
                                <div className={widgetStyles.barTrack}>
                                    <div className={widgetStyles.barFill} style={{ width: `${Math.min(data.cpu, 100)}%`, backgroundColor: getStatusColor(data.status) }} />
                                </div>
                            </div>
                            <div className={widgetStyles.miniBar}>
                                <span className={widgetStyles.miniLabel}>MEM</span>
                                <div className={widgetStyles.barTrack}>
                                    <div className={widgetStyles.barFill} style={{ width: `${Math.min(data.memory, 100)}%`, backgroundColor: getStatusColor(data.status) }} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
