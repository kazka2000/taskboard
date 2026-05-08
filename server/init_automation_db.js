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

async function initAutomationDB() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS automation_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                trigger_event VARCHAR(50) NOT NULL,
                trigger_condition JSON,
                action_type VARCHAR(50) NOT NULL,
                action_data JSON,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);
        console.log('Table automation_rules created or already exists.');

    } catch (error) {
        console.error('Database initialization failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

initAutomationDB();
