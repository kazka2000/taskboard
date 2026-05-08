const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taskboard',
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to the database.');

        // 1. Create Roles Table
        console.log('Creating roles table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                description VARCHAR(255)
            )
        `);

        // Seed roles if empty
        const [rolesResult] = await connection.query('SELECT COUNT(*) as count FROM roles');
        if (rolesResult[0].count === 0) {
            console.log('Seeding default roles...');
            await connection.query(`
                INSERT INTO roles (name, description) VALUES 
                ('admin', 'System Administrator with full access'),
                ('team_manager', 'Manager with access scoped to their team'),
                ('member', 'Regular user')
            `);
        }

        // 2. Create Teams Table
        console.log('Creating teams table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description VARCHAR(255)
            )
        `);

        // Seed default team for existing users
        const [teamsResult] = await connection.query('SELECT COUNT(*) as count FROM teams');
        if (teamsResult[0].count === 0) {
            console.log('Seeding default team...');
            await connection.query(`
                INSERT INTO teams (name, description) VALUES 
                ('Default Team', 'Default team for existing users')
            `);
        }

        // 3. Add team_id to users
        console.log('Checking for team_id column in users table...');
        const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'team_id'");
        if (columns.length === 0) {
            console.log('Adding team_id column to users table...');
            await connection.query('ALTER TABLE users ADD COLUMN team_id INT DEFAULT 1');
            console.log('Applying foreign key constraint...');
            // Need to make sure existing users have team_id = 1 (we used DEFAULT 1, but let's be sure for FK)
            await connection.query('UPDATE users SET team_id = 1 WHERE team_id IS NULL');
            await connection.query('ALTER TABLE users ADD CONSTRAINT fk_user_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL');
        } else {
            console.log('team_id column already exists.');
        }

        // 4. Migrate role to reference roles table if needed.
        // For now, the implementation plan states: "we will maintain the role column in users as a string referencing roles.name".
        // Ensure that `team_manager` is a valid string that the frontend can handle, which it is.

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

migrate();
