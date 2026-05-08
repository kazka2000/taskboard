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
        console.log("Connected to database.");

        // Check if column exists
        const [columns] = await connection.execute("SHOW COLUMNS FROM tasks LIKE 'position'");

        if (columns.length === 0) {
            console.log("Adding 'position' column to 'tasks' table...");
            await connection.execute("ALTER TABLE tasks ADD COLUMN position INT DEFAULT 0");
            console.log("'position' column added successfully.");
        } else {
            console.log("'position' column already exists.");
        }

        await connection.end();
        console.log("Migration complete.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrate();
