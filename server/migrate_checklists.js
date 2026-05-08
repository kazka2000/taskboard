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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS task_checklists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                content TEXT,
                is_completed BOOLEAN DEFAULT false,
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        console.log('task_checklists table created successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
