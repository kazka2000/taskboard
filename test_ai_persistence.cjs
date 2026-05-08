const aiService = require('./server/services/aiService');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testPersistence() {
    // 1. Connect DB
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    aiService.initialize(pool);

    // 2. Create Dummy Task
    const [res] = await pool.execute("INSERT INTO tasks (title, description, project_id, list_id) VALUES ('AI Persistence Test', 'Testing history', 1, 1)");
    const taskId = res.insertId;
    console.log(`Created Test Task ID: ${taskId}`);

    // 3. Simulate Chat Stream (User Message)
    const messages = [{ role: 'user', content: 'Create a checklist item: "Buy Milk"' }];
    const taskContext = { id: taskId, title: 'AI Persistence Test', description: 'Testing history', project_id: 1 };

    console.log('--- Starting Chat Stream ---');
    const generator = aiService.chatStream({ messages, taskContext, projectContext: { title: 'Test Project' } });

    for await (const chunk of generator) {
        if (chunk.type === 'text') process.stdout.write(chunk.content);
    }
    console.log('\n--- Chat Stream Ended ---');

    console.log('\n--- Verifying Persistence ---');
    // 4. Verify DB
    const [rows] = await pool.execute('SELECT * FROM task_ai_chats WHERE task_id = ? ORDER BY id ASC', [taskId]);
    console.log(`Saved Messages: ${rows.length}`);
    rows.forEach(r => console.log(`[${r.role}] ${r.content}`));

    // 5. Cleanup
    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    await pool.end();
}

testPersistence().catch(console.error);
