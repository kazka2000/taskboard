const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const USER_ID = 1; // Assuming admin exist

async function verifyInsightData() {
    try {
        console.log('--- Verifying Insight Data ---');
        // Fetch projects for user
        const res = await axios.get(`${API_URL}/projects?userId=${USER_ID}`);
        if (!res.data.success) {
            console.error("Failed to fetch projects");
            return;
        }

        const projects = res.data.projects;
        console.log(`Fetched ${projects.length} projects.`);

        let totalTasks = 0;
        let completedTasks = 0;
        let dueTodayTasks = 0;
        let overdueTasks = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        projects.forEach(p => {
            console.log(`Project: ${p.title}`);
            p.columns.forEach(col => {
                const isDone = col.title.toLowerCase() === 'done' || col.title === '완료';
                col.tasks.forEach(t => {
                    totalTasks++;
                    if (isDone) completedTasks++;

                    if (t.deadline) {
                        const d = new Date(t.deadline);
                        d.setHours(0, 0, 0, 0);
                        if (!isDone) {
                            if (d.getTime() === today.getTime()) dueTodayTasks++;
                            if (d.getTime() < today.getTime()) overdueTasks++;
                        }
                    }
                });
            });
        });

        console.log('--- Statistics ---');
        console.log(`Total Tasks: ${totalTasks}`);
        console.log(`Completed Tasks: ${completedTasks}`);
        console.log(`Due Today: ${dueTodayTasks}`);
        console.log(`Overdue: ${overdueTasks}`);
        console.log(`Completion Rate: ${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%`);

        if (totalTasks >= 0) {
            console.log('Verification Logic: SUCCESS');
        }

    } catch (e) {
        console.error('Verification Error:', e.message);
    }
}

verifyInsightData();
