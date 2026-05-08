const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard'
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Add workspace_id column to projects if not exists
        // Check if column exists first to avoid error
        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM projects LIKE 'workspace_id'
        `);

        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE projects
                ADD COLUMN workspace_id INT,
                ADD CONSTRAINT fk_project_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            `);
            console.log('Added workspace_id column to projects table.');
        } else {
            console.log('workspace_id column already exists.');
        }

        // 2. Migrate existing projects
        // Find all users who own projects but don't have a workspace (or just find all users)
        // For simplicity, we'll iterate through all users, create a default workspace if they don't have one,
        // and assign their unassigned projects to it.

        const [users] = await connection.execute('SELECT id, name FROM users');

        for (const user of users) {
            // Check if user has any projects without workspace
            const [projects] = await connection.execute('SELECT id FROM projects WHERE owner_id = ? AND workspace_id IS NULL', [user.id]);

            if (projects.length > 0) {
                console.log(`User ${user.name} (ID: ${user.id}) has ${projects.length} unassigned projects. Creating default workspace.`);

                // Create default workspace
                const workspaceName = `${user.name}'s Workspace`;
                const [result] = await connection.execute('INSERT INTO workspaces (name, owner_id) VALUES (?, ?)', [workspaceName, user.id]);
                const workspaceId = result.insertId;

                // Add user as admin to workspace_members
                await connection.execute('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)', [workspaceId, user.id, 'admin']);

                // Assign projects to this workspace
                await connection.execute('UPDATE projects SET workspace_id = ? WHERE owner_id = ? AND workspace_id IS NULL', [workspaceId, user.id]);
                console.log(`Assigned projects to workspace ${workspaceName} (ID: ${workspaceId}).`);
            }
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
