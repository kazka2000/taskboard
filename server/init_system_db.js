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

async function initSystemDB() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cpu_usage INT,
                memory_usage INT,
                status VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table system_logs created or already exists.');

        // Add columns for multi-server support if they don't exist
        try {
            await connection.execute('ALTER TABLE system_logs ADD COLUMN server_name VARCHAR(255) DEFAULT "Primary"');
            console.log('Added server_name column');
        } catch (e) { /* ignore if exists */ }

        try {
            await connection.execute('ALTER TABLE system_logs ADD COLUMN related_task_id INT');
            console.log('Added related_task_id column');
        } catch (e) { /* ignore */ }

        try {
            await connection.execute('ALTER TABLE system_logs ADD COLUMN related_project_id INT');
            console.log('Added related_project_id column');
        } catch (e) { /* ignore */ }

    } catch (error) {
        console.error('Database initialization failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

initSystemDB();
