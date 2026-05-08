const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00'
};

async function migrate() {
    console.log('Starting migration...');
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('1. Checking project_lists table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS project_lists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                position INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);
        console.log(' - project_lists table verified/created.');

        console.log('2. checking list_id column in tasks...');
        const [columns] = await connection.execute("SHOW COLUMNS FROM tasks LIKE 'list_id'");
        if (columns.length === 0) {
            console.log(' - Adding list_id column to tasks table...');
            await connection.execute(`
                ALTER TABLE tasks 
                ADD COLUMN list_id INT AFTER project_id,
                ADD FOREIGN KEY (list_id) REFERENCES project_lists(id) ON DELETE CASCADE
            `);
            console.log(' - list_id column added.');
        } else {
            console.log(' - list_id column already exists.');
        }

        console.log('3. check position column in tasks...');
        const [posColumns] = await connection.execute("SHOW COLUMNS FROM tasks LIKE 'position'");
        if (posColumns.length === 0) {
            console.log(' - Adding position column to tasks table...');
            await connection.execute(`
                ALTER TABLE tasks
                ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER list_id
             `);
            console.log(' - position column added.');
        } else {
            console.log(' - position column already exists.');
        }


        console.log('4. Migrating data...');
        // Get all projects
        const [projects] = await connection.execute('SELECT id FROM projects');

        for (const project of projects) {
            const projectId = project.id;

            // Check if lists exist for this project
            const [lists] = await connection.execute(
                'SELECT * FROM project_lists WHERE project_id = ? ORDER BY position',
                [projectId]
            );

            let todoListId, inProgressListId, doneListId;

            if (lists.length === 0) {
                console.log(` - Creating default lists for project ${projectId}...`);
                // Create default lists
                const defaultLists = ['To Do', 'In Progress', 'Done'];
                const createdLists = [];

                for (let i = 0; i < defaultLists.length; i++) {
                    const [result] = await connection.execute(
                        'INSERT INTO project_lists (project_id, title, position) VALUES (?, ?, ?)',
                        [projectId, defaultLists[i], i]
                    );
                    createdLists.push({ id: result.insertId, title: defaultLists[i] });
                }

                todoListId = createdLists[0].id;
                inProgressListId = createdLists[1].id;
                doneListId = createdLists[2].id;
            } else {
                console.log(` - Lists already exist for project ${projectId}. using existing ones for mapping.`);
                // Try to find matching lists by name, or fallback to index
                todoListId = lists.find(l => l.title === 'To Do')?.id || lists[0].id;
                inProgressListId = lists.find(l => l.title === 'In Progress')?.id || lists[1]?.id || lists[0].id;
                doneListId = lists.find(l => l.title === 'Done')?.id || lists[2]?.id || lists[0].id;
            }

            // Update tasks with NULL list_id based on 'status' column if it exists, or default to To Do
            // First check if status column exists
            const [statusCols] = await connection.execute("SHOW COLUMNS FROM tasks LIKE 'status'");
            const hasStatus = statusCols.length > 0;

            if (hasStatus) {
                console.log(` - Migrating tasks for project ${projectId} using status column...`);

                // pending -> todo
                await connection.execute(
                    'UPDATE tasks SET list_id = ? WHERE project_id = ? AND list_id IS NULL AND status = ?',
                    [todoListId, projectId, 'pending']
                );
                // progress -> in progress
                await connection.execute(
                    'UPDATE tasks SET list_id = ? WHERE project_id = ? AND list_id IS NULL AND status = ?',
                    [inProgressListId, projectId, 'progress']
                );
                // completed -> done
                await connection.execute(
                    'UPDATE tasks SET list_id = ? WHERE project_id = ? AND list_id IS NULL AND status = ?',
                    [doneListId, projectId, 'completed']
                );

                // Remaining NULLs -> todo
                await connection.execute(
                    'UPDATE tasks SET list_id = ? WHERE project_id = ? AND list_id IS NULL',
                    [todoListId, projectId]
                );

            } else {
                console.log(` - No status column. setting null list_id tasks to first list (ID: ${todoListId})...`);
                await connection.execute(
                    'UPDATE tasks SET list_id = ? WHERE project_id = ? AND list_id IS NULL',
                    [todoListId, projectId]
                );
            }
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
