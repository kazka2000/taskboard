const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database for Webhook migration...');

        // Create project_webhooks table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS project_webhooks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                platform_name VARCHAR(50) NOT NULL COMMENT 'Slack, Discord, Teams',
                webhook_url TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                INDEX idx_project_webhooks (project_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Migration: project_webhooks table created or verified.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
