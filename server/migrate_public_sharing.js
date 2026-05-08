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

async function migratePublicSharing() {
    let connection;
    try {
        console.log('Starting Public Sharing Migration...');
        connection = await mysql.createConnection(dbConfig);

        // 1. Check if columns exist in projects table
        const [columns] = await connection.execute('SHOW COLUMNS FROM projects');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('is_public')) {
            console.log('Adding is_public column...');
            await connection.execute(`
                ALTER TABLE projects 
                ADD COLUMN is_public BOOLEAN DEFAULT FALSE
            `);
        } else {
            console.log('is_public column already exists.');
        }

        if (!columnNames.includes('public_token')) {
            console.log('Adding public_token column...');
            await connection.execute(`
                ALTER TABLE projects 
                ADD COLUMN public_token VARCHAR(255) UNIQUE DEFAULT NULL
            `);
        } else {
            console.log('public_token column already exists.');
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

migratePublicSharing();
