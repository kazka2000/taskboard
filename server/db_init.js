const mysql = require('mysql2/promise');

async function initDB() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '', // Assuming no password for root as per plan
    });

    try {
        await connection.query('CREATE DATABASE IF NOT EXISTS taskboard');
        console.log('Database taskboard created or already exists.');

        await connection.query('USE taskboard');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                role VARCHAR(20) DEFAULT 'user',
                avatar VARCHAR(255)
            )
        `;
        await connection.query(createTableQuery);

        // Projects Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                start_date DATE,
                end_date DATE,
                owner_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            )
        `);

        // Project Members Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS project_members (
                project_id INT,
                user_id INT,
                role VARCHAR(50) DEFAULT 'member',
                PRIMARY KEY (project_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Tasks Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'To Do',
                tag VARCHAR(50),
                deadline DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        // Task Assignees Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS task_assignees (
                task_id INT,
                user_id INT,
                PRIMARY KEY (task_id, user_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Task AI Chats Table (New)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS task_ai_chats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                role ENUM('user', 'ai') NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);

        // Invitations Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS invitations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'member',
                token VARCHAR(64) NOT NULL UNIQUE,
                status ENUM('PENDING', 'ACCEPTED', 'EXPIRED') DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        `);

        console.log('Tables (users, projects, members, tasks, assignees) created or checked.');

        // Check if users exist using count
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');

        if (rows[0].count === 0) {
            const users = [
                ['admin', 'admin123', 'Administrator', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'],
                ['user1', 'user123', 'User One', 'user', 'https://api.dicebear.com/7.x/avataaars/svg?seed=User1'],
                ['user2', 'user223', 'User Two', 'user', 'https://api.dicebear.com/7.x/avataaars/svg?seed=User2'],
                ['user3', 'user323', 'User Three', 'user', 'https://api.dicebear.com/7.x/avataaars/svg?seed=User3']
            ];

            const insertQuery = 'INSERT INTO users (username, password, name, role, avatar) VALUES ?';
            await connection.query(insertQuery, [users]);
            console.log('Default users inserted.');
        } else {
            console.log('Users already exist, skipping insertion.');
        }

    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        await connection.end();
    }
}

initDB();
