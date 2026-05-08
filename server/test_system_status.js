const axios = require('axios');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function testSystemPulse() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // 1. Get a Project ID
        const [projects] = await connection.execute('SELECT id FROM projects LIMIT 1');
        if (projects.length === 0) {
            console.log('No projects found. Please create a project first.');
            return;
        }
        const projectId = projects[0].id;

        // 2. Ensure Automation Rule and Project Background
        // ... (Rule setup if needed, simplified for brevity as it persists)

        // 3. Send Critical Status for Primary Server
        console.log('--- Testing Primary Server ---');
        await axios.post('http://localhost:3000/api/system/status', {
            cpu: 95,
            memory: 88,
            status: 'Critical',
            server_name: 'Primary-DB-01'
        });
        console.log('Sent Critical for Primary-DB-01');

        // 4. Send Warning for Secondary Server
        console.log('--- Testing Secondary Server ---');
        await axios.post('http://localhost:3000/api/system/status', {
            cpu: 60,
            memory: 45,
            status: 'Warning',
            server_name: 'Socket-Node-02'
        });
        console.log('Sent Warning for Socket-Node-02');

        // 5. Verification Check
        await new Promise(r => setTimeout(r, 1000));

        const [tasks] = await connection.execute('SELECT * FROM tasks WHERE title LIKE ? ORDER BY id DESC LIMIT 1', ['%Primary-DB-01%']);
        if (tasks.length > 0) {
            console.log(`✅ SUCCESS: Critical Alert Task Created: ${tasks[0].title}`);
            console.log(`🔗 Shortcut Link should be: /project/${projectId}?openTask=${tasks[0].id}`);
        } else {
            console.log('❌ FAILURE: Task was not created for Primary-DB-01.');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

testSystemPulse();
