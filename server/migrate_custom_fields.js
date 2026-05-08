const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taskboard'
};

async function migrateCustomFields() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create custom_field_definitions table
        const createDefinitionsTable = `
            CREATE TABLE IF NOT EXISTS custom_field_definitions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                type ENUM('text', 'number', 'checkbox', 'date') NOT NULL DEFAULT 'text',
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `;
        await connection.query(createDefinitionsTable);
        console.log('Table custom_field_definitions created/verified.');

        // 2. Create custom_field_values table
        const createValuesTable = `
            CREATE TABLE IF NOT EXISTS custom_field_values (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                field_definition_id INT NOT NULL,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (field_definition_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
                UNIQUE KEY unique_task_field (task_id, field_definition_id)
            )
        `;
        await connection.query(createValuesTable);
        console.log('Table custom_field_values created/verified.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrateCustomFields();
