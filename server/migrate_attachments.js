const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Assuming no password as per previous config
    database: 'taskboard'
};

async function migrateAttachments() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Create task_attachments table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS task_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT,
                file_type VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `;

        await connection.query(createTableQuery);
        console.log('task_attachments table created or already exists.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrateAttachments();
