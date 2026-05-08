const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'taskboard'
    });

    try {
        console.log('Starting migration...');

        // 1. Create project_lists table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS project_lists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT,
                title VARCHAR(255) NOT NULL,
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);
        console.log('Created project_lists table.');

        // 2. Add list_id to tasks table
        // Check if column exists first to avoid error on re-run
        const [columns] = await connection.query(`SHOW COLUMNS FROM tasks LIKE 'list_id'`);
        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE tasks ADD COLUMN list_id INT,
                ADD FOREIGN KEY (list_id) REFERENCES project_lists(id) ON DELETE CASCADE
            `);
            console.log('Added list_id column to tasks.');
        }

        // 3. Migrate Data
        // Get all projects
        const [projects] = await connection.query('SELECT id FROM projects');

        const defaultLists = ['To Do', 'In Progress', 'Review', 'Done'];

        for (const project of projects) {
            console.log(`Processing Project ID: ${project.id}`);

            // Check if lists already exist for this project
            const [existingLists] = await connection.query('SELECT * FROM project_lists WHERE project_id = ?', [project.id]);

            let listMap = {}; // title -> list_id

            if (existingLists.length === 0) {
                // Create default lists
                for (let i = 0; i < defaultLists.length; i++) {
                    const title = defaultLists[i];
                    const [result] = await connection.query(
                        'INSERT INTO project_lists (project_id, title, position) VALUES (?, ?, ?)',
                        [project.id, title, i]
                    );
                    listMap[title] = result.insertId;
                }
                console.log(`   Created default lists for Project ${project.id}`);
            } else {
                existingLists.forEach(l => listMap[l.title] = l.id);
                console.log(`   Lists already exist for Project ${project.id}`);
            }

            // Migrate Tasks for this project
            // We need to map old 'status' (string) to new 'list_id' (int)
            // If task status doesn't match default lists, map to first list or handle appropriately?
            // Assuming status matches the default lists exactly as they were hardcoded.

            for (const title of defaultLists) {
                const listId = listMap[title];
                if (listId) {
                    await connection.query(
                        'UPDATE tasks SET list_id = ? WHERE project_id = ? AND status = ? AND list_id IS NULL',
                        [listId, project.id, title]
                    );
                }
            }
        }
        console.log('Data migration completed.');

        // 4. Drop status column (Optional: User asked to "replace", so removing is correct)
        // But let's check if we migrated everything first
        const [unmigrated] = await connection.query('SELECT count(*) as count FROM tasks WHERE list_id IS NULL');
        if (unmigrated[0].count > 0) {
            console.warn(`Warning: ${unmigrated[0].count} tasks have NULL list_id. NOT dropping status column yet.`);
        } else {
            // Check if status column exists
            const [statusCol] = await connection.query(`SHOW COLUMNS FROM tasks LIKE 'status'`);
            if (statusCol.length > 0) {
                await connection.query('ALTER TABLE tasks DROP COLUMN status');
                console.log('Dropped status column from tasks.');
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
