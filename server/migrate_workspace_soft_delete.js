const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Add deleted_at column to workspaces table
        try {
            await connection.query(`
                ALTER TABLE workspaces
                ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
            `);
            console.log('Added deleted_at column to workspaces table.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column deleted_at already exists.');
            } else {
                throw err;
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
