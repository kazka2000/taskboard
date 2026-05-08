const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard'
};

/*
Table Structure:
id INT AUTO_INCREMENT PRIMARY KEY
user_id INT NOT NULL
type VARCHAR(50) NOT NULL (e.g., 'assigned', 'comment', 'system')
message TEXT
is_read BOOLEAN DEFAULT FALSE
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
*/

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Notifications table created or already exists.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
