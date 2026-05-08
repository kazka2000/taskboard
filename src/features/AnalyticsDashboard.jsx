import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import styles from './AnalyticsDashboard.module.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function AnalyticsDashboard({ onFilterAssignee }) {
    const { projectId } = useParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get(`http://localhost:3000/api/projects/${projectId}/stats`);
                if (response.data.success) {
                    setStats(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchStats();
        }
    }, [projectId]);

    if (loading) return <div className={styles.loading}>Loading analytics...</div>;
    if (!stats) return <div className={styles.error}>Failed to load analytics.</div>;

    const { columnStats, assigneeStats, labelStats, burndownData } = stats;

    // Handlers
    const handleAssigneeClick = (data) => {
        // data.activePayload check for Recharts Click event
        if (data && data.activePayload && data.activePayload.length > 0) {
            const assigneeName = data.activePayload[0].payload.name;
            // We need ID for filtering, but API returns name. 
            // Ideally API should return ID too.
            // Let's assume we can map it or pass it. 
            // Wait, previous step API implementation for assigneeStats:
            // "SELECT u.name, t.list_id..." -> doesn't select u.id.
            // I should update API to return u.id as well for robust filtering.
            // For now, let's just log or try name if filter accepts it?
            // Board filterAssignee accepts ID.
            // I will update the API briefly in next step to include ID.
            // Assuming data contains ID now.
            if (onFilterAssignee) {
                onFilterAssignee(data.activePayload[0].payload.id);
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {/* 1. Pie Chart: Task Distribution by List */}
                <div className={styles.card}>
                    <h3>태스크 상태 분포 (Task Distribution)</h3>
                    <div className={styles.chartWrapper}>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={columnStats}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ title, percent }) => `${title} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                    nameKey="title" // Map 'title' property to name
                                >
                                    {columnStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Bar Chart: Assignee Workload */}
                <div className={styles.card}>
                    <h3>담당자별 업무 (Assignee Workload)</h3>
                    <div className={styles.chartWrapper}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={assigneeStats}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                onClick={handleAssigneeClick}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="active" stackId="a" fill="#8884d8" name="진행 중 (Active)" />
                                <Bar dataKey="completed" stackId="a" fill="#82ca9d" name="완료 (Completed)" />
                            </BarChart>
                        </ResponsiveContainer>
                        <p className={styles.hint}>* 막대를 클릭하면 해당 담당자로 필터링됩니다.</p>
                    </div>
                </div>

                {/* 3. Line Chart: Burndown (Project Progress) */}
                <div className={styles.cardFull}>
                    <h3>프로젝트 진행률 (Burnup/Down)</h3>
                    <div className={styles.chartWrapper}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                                data={burndownData}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="completed" stroke="#8884d8" name="누적 완료 (Cumulative Completed)" activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
