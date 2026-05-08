const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00'
};

async function migrate() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Create task_comments table
        // type: 'comment' (user generated) or 'activity' (system generated)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS task_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT,
                type ENUM('comment', 'activity', 'ai_result') DEFAULT 'comment',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('task_comments table created or already exists.');

        await connection.end();
        console.log('Migration completed.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
