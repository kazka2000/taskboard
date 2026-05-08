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

const tagColors = {
    'general': '#61bd4f', // Green
    'urgent': '#eb5a46',  // Red
    'bug': '#eb5a46',     // Red
    'design': '#0079bf',  // Blue
    'dev': '#0079bf',     // Blue
    'backend': '#00c2e0', // Cyan
    'frontend': '#ff78cb' // Pink
};

const defaultColor = '#b3bac5'; // Grey

async function migrateLabels() {
    let connection;
    try {
        console.log('Starting Label System Migration...');
        connection = await mysql.createConnection(dbConfig);

        // 1. Create Tables
        console.log('Creating tables...');

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS labels (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                color VARCHAR(7) NOT NULL,
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS task_labels (
                task_id INT NOT NULL,
                label_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (task_id, label_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
            )
        `);

        console.log('Tables created successfully.');

        // 2. Migrate Tags
        console.log('Migrating existing tags...');

        // Get all tasks with tags
        const [tasks] = await connection.execute('SELECT id, project_id, tag FROM tasks WHERE tag IS NOT NULL AND tag != ""');

        if (tasks.length === 0) {
            console.log('No tags found to migrate.');
            return;
        }

        // Cache for created labels: key = `${projectId}:${tagName.toLowerCase()}`, value = labelId
        const labelCache = new Map();

        for (const task of tasks) {
            const tagName = task.tag.trim();
            const project = task.project_id;
            const cacheKey = `${project}:${tagName.toLowerCase()}`;

            if (!project) continue; // Skip if no project (shouldn't happen given schema but safety first)

            let labelId = labelCache.get(cacheKey);

            if (!labelId) {
                // Check if label exists in DB (in case of re-run or parallel processing)
                const [existing] = await connection.execute(
                    'SELECT id FROM labels WHERE project_id = ? AND name = ?',
                    [project, tagName]
                );

                if (existing.length > 0) {
                    labelId = existing[0].id;
                } else {
                    // Create new label
                    const color = tagColors[tagName.toLowerCase()] || defaultColor;

                    // Get max position
                    const [posRows] = await connection.execute('SELECT MAX(position) as maxPos FROM labels WHERE project_id = ?', [project]);
                    const newPos = (posRows[0].maxPos || 0) + 1;

                    const [result] = await connection.execute(
                        'INSERT INTO labels (project_id, name, color, position) VALUES (?, ?, ?, ?)',
                        [project, tagName, color, newPos]
                    );
                    labelId = result.insertId;
                    console.log(`Created label "${tagName}" for Project ${project}`);
                }
                labelCache.set(cacheKey, labelId);
            }

            // Assign label to task
            try {
                await connection.execute(
                    'INSERT IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)',
                    [task.id, labelId]
                );
            } catch (err) {
                console.error(`Failed to assign label ${labelId} to task ${task.id}:`, err.message);
            }
        }

        console.log(`Successfully migrated tags for ${tasks.length} tasks.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

migrateLabels();
