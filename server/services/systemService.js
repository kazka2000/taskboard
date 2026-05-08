const mysql = require('mysql2/promise');

let pool;

function initialize(dbPool) {
    pool = dbPool;
}

async function logStatus(data) {
    if (!pool) throw new Error('System Service not initialized');
    const { cpu, memory, status, serverName, taskId, projectId } = data;

    try {
        await pool.execute(
            'INSERT INTO system_logs (cpu_usage, memory_usage, status, server_name, related_task_id, related_project_id) VALUES (?, ?, ?, ?, ?, ?)',
            [cpu, memory, status, serverName || 'Primary', taskId || null, projectId || null]
        );
        return true;
    } catch (error) {
        console.error('Failed to log system status:', error);
        return false;
    }
}

async function checkAutomation(status, serverName) {
    if (!pool) return null;
    if (status !== 'Critical') return null;

    try {
        // Find active rules for system_critical
        const [rules] = await pool.execute(
            'SELECT * FROM automation_rules WHERE trigger_event = ? AND is_active = TRUE',
            ['system_critical']
        );

        let createdTaskInfo = null;
        for (const rule of rules) {
            const result = await executeAction(rule, serverName);
            if (result) createdTaskInfo = result; // Return last created task info
        }
        return createdTaskInfo;
    } catch (error) {
        console.error('Automation check failed:', error);
        return null;
    }
}

async function executeAction(rule, serverName) {
    if (rule.action_type === 'create_task') {
        try {
            const actionData = typeof rule.action_data === 'string' ? JSON.parse(rule.action_data) : rule.action_data;
            const project_id = rule.project_id;

            // Get first list id
            const [lists] = await pool.execute('SELECT id FROM project_lists WHERE project_id = ? ORDER BY position ASC LIMIT 1', [project_id]);
            const listId = lists.length > 0 ? lists[0].id : null;

            if (!listId) return null;

            const title = `${actionData.title || 'System Alert'} [${serverName || 'Primary'}]`;

            // Create Task
            const [result] = await pool.execute(
                'INSERT INTO tasks (project_id, list_id, title, description, position) VALUES (?, ?, ?, ?, 0)',
                [
                    project_id,
                    listId,
                    title,
                    actionData.description || `Auto-generated task due to system failure on server ${serverName || 'Primary'}.`
                ]
            );
            console.log(`Automation: Created task in project ${project_id}`);
            return { taskId: result.insertId, projectId: project_id };
        } catch (e) {
            console.error('Failed to execute automation action:', e);
            return null;
        }
    }
    return null;
}

module.exports = {
    initialize,
    logStatus,
    checkAutomation
};
