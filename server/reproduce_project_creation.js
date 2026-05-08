const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00'
};

/*
 Frontend Payload Example:
 {
    "title": "Web Dev Test",
    "description": "Web development template test",
    "startDate": "", // or "2026-01-01"
    "endDate": "",
    "ownerId": 1,
    "template": "web_dev"
 }
*/

async function testCreate() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to DB');

        // Test Case 1: Empty Dates (reproducing typical frontend default)
        console.log('--- Test Case 1: Empty Dates ---');
        try {
            const title = 'CLI Test Empty Dates';
            const description = 'Desc';
            const startDate = '';
            const endDate = '';
            const ownerId = 1;
            const template = 'web_dev';

            const [result] = await connection.execute(
                'INSERT INTO projects (title, description, start_date, end_date, owner_id) VALUES (?, ?, ?, ?, ?)',
                [title, description || null, startDate || null, endDate || null, ownerId]
            );
            console.log('Project Inserted (Empty Dates), ID:', result.insertId);

            // Clean up lists logic test separate or implied
        } catch (e) {
            console.error('Test Case 1 Failed:', e.message);
        }

        // Test Case 2: Valid Dates
        console.log('--- Test Case 2: Valid Dates ---');
        try {
            const title = 'CLI Test Valid Dates';
            const description = 'Desc';
            const startDate = '2026-01-01';
            const endDate = '2026-12-31';
            const ownerId = 1;
            const template = 'sales';

            const [result] = await connection.execute(
                'INSERT INTO projects (title, description, start_date, end_date, owner_id) VALUES (?, ?, ?, ?, ?)',
                [title, description || null, startDate || null, endDate || null, ownerId]
            );
            console.log('Project Inserted (Valid Dates), ID:', result.insertId);
        } catch (e) {
            console.error('Test Case 2 Failed:', e.message);
        }

        // Check Users
        const [users] = await connection.execute('SELECT * FROM users');
        console.log('Users found:', users.map(u => ({ id: u.id, username: u.username })));

        await connection.end();
        console.log('Done');
    } catch (error) {
        console.error('Global Error:', error);
    }
}

testCreate();
