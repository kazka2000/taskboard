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

        // Check if columns exist
        const [columns] = await connection.execute('SHOW COLUMNS FROM projects LIKE "background_type"');

        if (columns.length === 0) {
            console.log('Adding background columns to projects table...');
            await connection.execute(`
                ALTER TABLE projects 
                ADD COLUMN background_type VARCHAR(20) DEFAULT 'color',
                ADD COLUMN background_value VARCHAR(255) DEFAULT 'default'
            `);
            console.log('Columns added successfully.');
        } else {
            console.log('Background columns already exist.');
        }

        console.log('Migration completed.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
