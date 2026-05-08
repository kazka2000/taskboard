require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');
const aiService = require('./services/aiService');
const config = require('./config');

async function testActions() {
    console.log("Connecting to DB...");
    const pool = mysql.createPool(config.db);

    aiService.initialize(pool);

    // Get a test task
    const [tasks] = await pool.execute('SELECT * FROM tasks LIMIT 1');
    if (tasks.length === 0) {
        console.log("No tasks found to test with.");
        process.exit(1);
    }
    const targetTask = tasks[0];
    console.log(`Testing with Task ID: ${targetTask.id} (${targetTask.title})`);

    // 1. Test UPDATE_DEADLINE
    console.log("\n--- Testing UPDATE_DEADLINE ---");
    const deadlineAction = {
        type: 'UPDATE_DEADLINE',
        date: '2026-12-31'
    };
    const res1 = await aiService.handleAction(deadlineAction, targetTask);
    console.log("Result:", res1);

    // Check DB
    const [t1] = await pool.execute('SELECT deadline FROM tasks WHERE id = ?', [targetTask.id]);
    console.log("DB deadline:", t1[0].deadline);

    // 2. Test UPDATE_ASSIGNEES (We need to fetch valid members first)
    console.log("\n--- Testing UPDATE_ASSIGNEES ---");
    const [members] = await pool.execute(
        'SELECT u.username FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ? LIMIT 2',
        [targetTask.project_id]
    );

    if (members.length > 0) {
        const usernames = members.map(m => m.username);
        console.log("Assigning users:", usernames);

        const assignAction = {
            type: 'UPDATE_ASSIGNEES',
            users: usernames
        };
        const res2 = await aiService.handleAction(assignAction, targetTask);
        console.log("Result:", res2);

        const [t2] = await pool.execute(
            'SELECT u.username FROM task_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = ?',
            [targetTask.id]
        );
        console.log("DB Assignees:", t2.map(u => u.username));
    } else {
        console.log("No users found to test assignment.");
    }

    console.log("\nDone testing.");
    process.exit(0);
}

testActions();
