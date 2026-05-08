const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard'
};

async function verify() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create a dummy workspace
        const [res] = await connection.execute(
            'INSERT INTO workspaces (name, description, owner_id) VALUES (?, ?, ?)',
            ['Test Soft Delete', 'Should be soft deleted', 1] // Assuming user 1 exists
        );
        const wsId = res.insertId;
        console.log(`Created test workspace ID: ${wsId}`);

        // 2. Simulate Soft Delete (UPDATE deleted_at)
        // We are testing the "Logic" embedded in the API, but here we test simply the schema support
        // and the fact that we can update it.
        await connection.execute('UPDATE workspaces SET deleted_at = NOW() WHERE id = ?', [wsId]);
        console.log(`Soft deleted workspace ID: ${wsId}`);

        // 3. Verify it still exists but has deleted_at
        const [rows] = await connection.execute('SELECT * FROM workspaces WHERE id = ?', [wsId]);
        if (rows.length > 0 && rows[0].deleted_at !== null) {
            console.log('SUCCESS: Workspace exists and has deleted_at timestamp.');
        } else {
            console.error('FAILURE: Workspace not found or deleted_at is null.');
        }

        // 4. Clean up (Hard delete for test cleanup)
        await connection.execute('DELETE FROM workspaces WHERE id = ?', [wsId]);
        console.log('Cleaned up test workspace.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

verify();
