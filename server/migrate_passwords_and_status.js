const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('./config');

async function migrate() {
    let pool;
    try {
        pool = mysql.createPool(config.db);
        console.log('Connected to the database.');

        // 1. Add status column if not exists
        const [columns] = await pool.query('SHOW COLUMNS FROM users LIKE "status"');
        if (columns.length === 0) {
            console.log('Adding status column to users table...');
            await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'");
            console.log('Status column added.');
        } else {
            console.log('Status column already exists.');
        }

        // 2. Hash existing plaintext passwords
        console.log('Checking for plaintext passwords to migrate...');
        const [users] = await pool.query('SELECT id, password FROM users');

        let migratedCount = 0;
        for (const user of users) {
            // A bcrypt hash looks like $2a$10$ or $2b$10$ and is 60 chars long.
            if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(user.password, salt);
                await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
                migratedCount++;
            }
        }
        console.log(`Successfully hashed plaintext passwords for ${migratedCount} existing users.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (pool) await pool.end();
        process.exit();
    }
}

migrate();
