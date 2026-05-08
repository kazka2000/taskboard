const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dbManager = require('./dbManager');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const { sendWebhook } = require('./utils/webhookSender');
const eventService = require('./services/eventService');
const systemService = require('./services/systemService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"], // Adjust as needed for production
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

// --- In-Memory Log Buffer ---
const serverLogs = [];
const MAX_LOGS = 50;

// Monkey-patch console.log/error to capture logs
const originalLog = console.log;
const originalError = console.error;

function captureLog(type, args) {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;

    serverLogs.push(logEntry);
    if (serverLogs.length > MAX_LOGS) serverLogs.shift();

    if (type === 'error') originalError.apply(console, args);
    else originalLog.apply(console, args);
}

console.log = (...args) => captureLog('info', args);
console.error = (...args) => captureLog('error', args);

const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Taskboard API Server is running. Use /api/... for endpoints.');
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinProject', (projectId) => {
        socket.join(`project_${projectId}`);
        console.log(`Socket ${socket.id} joined project_${projectId}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const mindfulService = require('./services/mindfulService');

// --- Mindful UI API ---
app.get('/api/mindful/context', async (req, res) => {
    try {
        const refresh = req.query.refresh === 'true';
        const context = await mindfulService.getContext(refresh);
        res.json({ success: true, context });
    } catch (error) {
        console.error('Mindful context error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- System Status API ---
// --- System Status API ---
app.post('/api/system/status', async (req, res) => {
    try {
        const { cpu, memory, status, server_name } = req.body;
        const serverName = server_name || 'Primary';

        // 1. Check Automation First (to get link)
        const taskInfo = await systemService.checkAutomation(status, serverName);

        // 2. Log to DB
        await systemService.logStatus({
            cpu,
            memory,
            status,
            serverName,
            taskId: taskInfo?.taskId,
            projectId: taskInfo?.projectId
        });

        // 3. Broadcast to all clients
        io.emit('system:status', {
            cpu,
            memory,
            status,
            serverName,
            timestamp: new Date(),
            relatedTaskId: taskInfo?.taskId,
            relatedProjectId: taskInfo?.projectId
        });

        res.json({ success: true, taskCreated: !!taskInfo });
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({ success: false });
    }
});

const pool = dbManager;

// Initialize Event Service
eventService.initialize(io, pool);
systemService.initialize(pool);

const dbConfig = { // Keep for legacy if needed, or better usage below
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'taskboard',
    timezone: '+09:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};




// File Upload Configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use Date.now() + originalname to prevent collision
        // UTF-8 filename safety: use strictly safe characters or URI component?
        // Let's just use raw originalname for now, but pre-pend timestamp.
        // To avoid encoding issues on different OSs, maybe sanitized? 
        // For this task, simple is fine.
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Serve Static Files (uploads)
// Access via /uploads/filename
app.use('/uploads', express.static(uploadDir));

// Pool created above, removing duplicate and dbConfig definition if redundant
// But dbConfig was used in pool creation above. 
// Just ensuring 'pool' is available globally.

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    console.log(`Login attempt for: ${username}`);
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length > 0) {
            const user = rows[0];

            if (user.status !== 'ACTIVE') {
                return res.status(403).json({ success: false, message: 'Account is not active' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            console.log(`[API /login] Success: Email and password exactly matched for user ${username}.`);
            console.log(`[API /login] Note: This system currently returns a JSON user object for localStorage mapping instead of a JWT token. Login successful.`);

            const { password: userPassword, ...userWithoutPassword } = user;
            res.json({ success: true, user: userWithoutPassword });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Admin Middleware ---
const requireAdmin = async (req, res, next) => {
    const userId = req.headers['x-user-id'] || req.body.adminId || req.query.adminId || req.body.userId || req.query.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized: User ID missing' });

    try {
        const [rows] = await pool.execute('SELECT id, role, team_id FROM users WHERE id = ?', [userId]);
        if (rows.length === 0 || rows[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admins Only' });
        }
        req.userContext = rows[0];
        next();
    } catch (e) {
        console.error('requireAdmin error:', e);
        res.status(500).json({ success: false, message: 'Server check role error' });
    }
};

const requireHierarchyAdmin = requireAdmin; // alias for clarity in hierarchy tasks

const requireManagerOrAdmin = async (req, res, next) => {
    const userId = req.headers['x-user-id'] || req.body.adminId || req.query.adminId || req.body.userId || req.query.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized: User ID missing' });

    try {
        const [rows] = await pool.execute('SELECT id, role, team_id FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Forbidden: User not found' });
        }
        const user = rows[0];
        if (user.role !== 'admin' && user.role !== 'team_manager') {
            return res.status(403).json({ success: false, message: 'Forbidden: Managers or Admins Only' });
        }
        req.userContext = user;
        next();
    } catch (e) {
        console.error('requireManagerOrAdmin error:', e);
        res.status(500).json({ success: false, message: 'Server check role error' });
    }
};

app.get('/api/users', async (req, res) => {
    const userId = req.headers['x-user-id'];
    try {
        let query = 'SELECT id, username, name, role, avatar, team_id FROM users';
        let params = [];

        if (userId) {
            const [userRows] = await pool.execute('SELECT role, team_id FROM users WHERE id = ?', [userId]);
            if (userRows.length > 0) {
                const currentUser = userRows[0];
                if (currentUser.role === 'team_manager') {
                    // Team Managers should only see 'member's within their team, not other managers or admins
                    query += ' WHERE team_id = ? AND role = "member"';
                    params.push(currentUser.team_id);
                }
            }
        }

        const [rows] = await pool.execute(query, params);
        res.json({ success: true, users: rows });
    } catch (error) {
        console.error('Fetch users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/users/:id', requireManagerOrAdmin, async (req, res) => {
    const userIdToUpdate = req.params.id;
    const { name, email, role, avatar, password, team_id } = req.body;
    const currentUser = req.userContext;

    if (!name || !email || !role) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // Uniqueness check for email (username)
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [email, userIdToUpdate]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already in use by another active user' });
        }

        // Team Authorization Check
        const [targetRows] = await pool.execute('SELECT team_id FROM users WHERE id = ?', [userIdToUpdate]);
        if (targetRows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        if (currentUser.role === 'team_manager' && targetRows[0].team_id !== currentUser.team_id) {
            return res.status(403).json({ success: false, message: 'Forbidden: Cannot edit users outside your team' });
        }

        let finalTeamId = team_id || targetRows[0].team_id;
        let finalRole = role;

        // Security check: Team managers cannot elevate roles to admin or team_manager, and cannot move teams
        if (currentUser.role === 'team_manager') {
            finalTeamId = currentUser.team_id; // Lock to their own team
            if (role === 'admin' || role === 'team_manager') {
                return res.status(403).json({ success: false, message: 'Forbidden: Cannot elevate user roles' });
            }
            // Allow them to assign any other custom role name
        }

        // Update the user
        let updateQuery = 'UPDATE users SET name = ?, username = ?, role = ?, team_id = ?';
        let queryParams = [name, email, finalRole, finalTeamId];

        if (avatar) {
            updateQuery += ', avatar = ?';
            queryParams.push(avatar);
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updateQuery += ', password = ?';
            queryParams.push(hashedPassword);
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(userIdToUpdate);

        const [result] = await pool.execute(updateQuery, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
});

// Delete user API with Manager/Admin access control
app.delete('/api/users/:id', requireManagerOrAdmin, async (req, res) => {
    const userIdToDelete = req.params.id;
    const currentUser = req.userContext;

    try {
        // Prevent deleting oneself
        if (currentUser.id.toString() === userIdToDelete.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        // Fetch target user's team ID
        const [targetRows] = await pool.execute('SELECT team_id FROM users WHERE id = ?', [userIdToDelete]);
        if (targetRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Team Authorization Check for Managers
        if (currentUser.role === 'team_manager' && targetRows[0].team_id !== currentUser.team_id) {
            return res.status(403).json({ success: false, message: 'Forbidden: Cannot delete users outside your team' });
        }

        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userIdToDelete]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
});

// --- Admin Invitation API ---
const sendInviteEmail = (email, token) => {
    const inviteUrl = `http://localhost:5173/invite/${token}`;
    console.log(`\n======================================================`);
    console.log(`✉️  [MOCK EMAIL SENT] To: ${email}`);
    console.log(`   Invite Link: ${inviteUrl}`);
    console.log(`======================================================\n`);
};

app.post('/api/admin/invite', requireAdmin, async (req, res) => {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
        // Prevent duplicate pending requests or reuse if accepted
        const [existing] = await pool.execute('SELECT id, status FROM invitations WHERE email = ?', [email]);
        if (existing.length > 0 && existing[0].status === 'ACCEPTED') {
            return res.status(400).json({ success: false, message: 'User already exists/accepted' });
        } else if (existing.length > 0) {
            // Update token for pending
            await pool.execute('UPDATE invitations SET token = ?, expires_at = ? WHERE email = ?', [token, expiresAt, email]);
        } else {
            await pool.execute(
                'INSERT INTO invitations (email, role, token, expires_at) VALUES (?, ?, ?, ?)',
                [email, role || 'member', token, expiresAt]
            );
        }

        sendInviteEmail(email, token);
        res.json({ success: true, message: 'Invitation sent' });
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ success: false, message: 'Server error scheduling invite' });
    }
});

app.post('/api/admin/invite/bulk', requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    try {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        const results = { successful: 0, failed: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            const email = records[i].email?.trim();
            const role = records[i].role?.trim() || 'member';

            if (!email || !/\S+@\S+\.\S+/.test(email)) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: Invalid or missing email (${email || 'Empty'})`);
                continue;
            }

            // Check if user already exists in active users table
            const [activeUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [email]);
            if (activeUser.length > 0) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: ${email} already an active user`);
                continue;
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            try {
                const [existing] = await pool.execute('SELECT id, status FROM invitations WHERE email = ?', [email]);
                if (existing.length > 0 && existing[0].status === 'ACCEPTED') {
                    results.failed++;
                    results.errors.push(`Row ${i + 2}: ${email} already accepted`);
                    continue;
                } else if (existing.length > 0) {
                    await pool.execute('UPDATE invitations SET token = ?, expires_at = ? WHERE email = ?', [token, expiresAt, email]);
                } else {
                    await pool.execute('INSERT INTO invitations (email, role, token, expires_at) VALUES (?, ?, ?, ?)', [email, role, token, expiresAt]);
                }
                sendInviteEmail(email, token);
                results.successful++;
            } catch (dbErr) {
                results.failed++;
                results.errors.push(`Row ${i + 2}: Database error for ${email}`);
            }
        }

        fs.unlinkSync(req.file.path); // clean up

        res.json({ success: true, results });
    } catch (error) {
        console.error('Bulk invite error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'Error processing CSV' });
    }
});

app.post('/api/admin/users/direct', requireManagerOrAdmin, async (req, res) => {
    const { name, email, password, role, avatar, team_id } = req.body;
    const currentUser = req.userContext;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

    try {
        const username = email;

        // Check active users first
        const [activeUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (activeUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already mapped to an active user' });
        }

        const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let finalTeamId = team_id || 1;
        let finalRole = role || 'member';

        // Security check: Team managers cannot create admins or other managers, and must create in their own team
        if (currentUser.role === 'team_manager') {
            finalTeamId = currentUser.team_id;
            if (role === 'admin' || role === 'team_manager') {
                return res.status(403).json({ success: false, message: 'Forbidden: Cannot create users with elevated roles' });
            }
        }

        await pool.execute(
            'INSERT INTO users (username, password, name, role, avatar, status, team_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, name, finalRole, avatar || defaultAvatar, 'ACTIVE', finalTeamId]
        );

        // Immediately revoke any old invitations since they directly add
        await pool.execute('UPDATE invitations SET status = "EXPIRED" WHERE email = ? AND status = "PENDING"', [email]);

        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error('Direct add error:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

// --- Public Invitation API (No auth required) ---
app.get('/api/invite/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT email, status, expires_at FROM invitations WHERE token = ?',
            [token]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Invalid token' });

        const invite = rows[0];
        if (invite.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Invitation already accepted or invalid' });
        if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ success: false, message: 'Invitation expired' });

        res.json({ success: true, email: invite.email });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/invite/accept', async (req, res) => {
    const { token, name, password } = req.body;
    if (!token || !name || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

    try {
        const [rows] = await pool.execute('SELECT id, email, role, status FROM invitations WHERE token = ?', [token]);
        if (rows.length === 0 || rows[0].status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        const invite = rows[0];
        const username = invite.email; // Let's use email as username for invited users
        const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

        // Check if username implicitly exists already though
        const [userRows] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (userRows.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // 1. Insert User
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.execute(
            'INSERT INTO users (username, password, name, role, avatar, status) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, name, invite.role, defaultAvatar, 'ACTIVE']
        );

        // 2. Mark Invitation Accepted
        await pool.execute('UPDATE invitations SET status = "ACCEPTED" WHERE id = ?', [invite.id]);

        res.json({ success: true, message: 'Account created successfully' });
    } catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

// --- Notifications API ---
app.get('/api/notifications', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error('Fetch notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Read notification error:', error);
        res.status(500).json({ success: false });
    }
});


// --- Workspaces API ---

app.get('/api/workspaces', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    try {
        // Check user role
        const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
        const userRole = users.length > 0 ? users[0].role : null;

        let rows;
        if (userRole === 'admin') {
            [rows] = await pool.execute(`
                SELECT * FROM workspaces WHERE deleted_at IS NULL
            `);
        } else {
            // Get workspaces where user is owner OR member
            [rows] = await pool.execute(`
                SELECT DISTINCT w.* 
                FROM workspaces w
                LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
                WHERE (w.owner_id = ? OR wm.user_id = ?) AND w.deleted_at IS NULL
            `, [userId, userId]);
        }

        res.json({ success: true, workspaces: rows });
    } catch (error) {
        console.error('Fetch workspaces error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/workspaces', async (req, res) => {
    const { name, description, ownerId } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO workspaces (name, description, owner_id) VALUES (?, ?, ?)',
            [name, description || null, ownerId]
        );
        const workspaceId = result.insertId;

        // Add owner as admin member
        await pool.execute(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
            [workspaceId, ownerId, 'admin']
        );

        res.json({ success: true, workspaceId });
    } catch (error) {
        console.error('Create workspace error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/workspaces/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await pool.execute(
            'UPDATE workspaces SET name = ?, description = ? WHERE id = ?',
            [name, description || null, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update workspace error:', error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/workspaces/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE workspaces SET deleted_at = NOW() WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete workspace error:', error);
        res.status(500).json({ success: false });
    }
});


// --- Projects API ---

app.get('/api/projects', async (req, res) => {
    const userId = req.query.userId;
    let finalWorkspaceId = req.query.workspaceId;
    if (finalWorkspaceId === 'undefined' || finalWorkspaceId === 'null' || finalWorkspaceId === '') {
        finalWorkspaceId = undefined;
    }

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    try {
        // Check user role
        const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
        const userRole = users.length > 0 ? users[0].role : null;

        let projects;

        if (userRole === 'admin') {
            // Admin sees ALL projects
            if (finalWorkspaceId) {
                [projects] = await pool.execute('SELECT * FROM projects WHERE workspace_id = ?', [finalWorkspaceId]);
            } else {
                [projects] = await pool.execute('SELECT * FROM projects');
            }
        } else {
            // Regular User Logic
            let query = `
                SELECT DISTINCT p.* 
                FROM projects p
                LEFT JOIN project_members pm ON p.id = pm.project_id
                LEFT JOIN tasks t ON p.id = t.project_id
                LEFT JOIN task_assignees ta ON t.id = ta.task_id
                WHERE (p.owner_id = ? 
                   OR pm.user_id = ?
                   OR ta.user_id = ?)
            `;
            const params = [userId, userId, userId];

            // If workspaceId is provided, filter by it
            if (finalWorkspaceId) {
                query += ` AND p.workspace_id = ?`;
                params.push(finalWorkspaceId);
            }
            [projects] = await pool.execute(query, params);
        }

        // For each project, get members, tasks (with assignees)
        const projectsWithDetails = await Promise.all(projects.map(async (project) => {
            // Get Members
            const [members] = await pool.execute(`
                SELECT u.id 
                FROM users u
                JOIN project_members pm ON u.id = pm.user_id
                WHERE pm.project_id = ?
            `, [project.id]);

            // Get Lists (sorted by position)
            const [lists] = await pool.execute(`
                SELECT * FROM project_lists WHERE project_id = ? ORDER BY position ASC
            `, [project.id]);

            // Get Tasks with checklist counts
            const [tasks] = await pool.execute(`
                SELECT t.*, 
                       DATE_FORMAT(t.deadline, '%Y-%m-%d') as deadline,
                       (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id) as checklist_total,
                       (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id AND is_completed = TRUE) as checklist_done,
                       (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count,
                       (SELECT file_path FROM task_attachments WHERE task_id = t.id AND file_type LIKE 'image/%' ORDER BY created_at DESC LIMIT 1) as cover_image
                FROM tasks t 
                WHERE t.project_id = ?
            `, [project.id]);

            // For each task, get assignees
            const tasksWithAssignees = await Promise.all(tasks.map(async (task) => {
                const [assignees] = await pool.execute(`
                    SELECT user_id FROM task_assignees WHERE task_id = ?
                `, [task.id]);
                return {
                    ...task,
                    assignees: assignees.map(a => a.user_id)
                };
            }));

            // Fetch Custom Field Definitions
            const [customFields] = await pool.execute(
                'SELECT * FROM custom_field_definitions WHERE project_id = ? ORDER BY position ASC',
                [project.id]
            );

            // Fetch Labels
            const [labels] = await pool.execute(
                'SELECT * FROM labels WHERE project_id = ? ORDER BY position ASC',
                [project.id]
            );

            // Fetch All Custom Field Values for this project's tasks
            let customFieldValues = [];
            let taskLabelsMap = new Map(); // task_id -> [label objects]

            if (tasks.length > 0) {
                const taskIds = tasks.map(t => t.id);
                // Create placeholders for IN clause
                const placeholders = taskIds.map(() => '?').join(',');

                // 1. Custom Field Values
                const [values] = await pool.execute(
                    `SELECT * FROM custom_field_values WHERE task_id IN (${placeholders})`,
                    taskIds
                );
                customFieldValues = values;

                // 2. Task Labels
                const [tLabels] = await pool.execute(
                    `SELECT tl.task_id, l.id, l.name, l.color 
                     FROM task_labels tl 
                     JOIN labels l ON tl.label_id = l.id 
                     WHERE tl.task_id IN (${placeholders})`,
                    taskIds
                );

                tLabels.forEach(tl => {
                    const tid = tl.task_id;
                    if (!taskLabelsMap.has(tid)) {
                        taskLabelsMap.set(tid, []);
                    }
                    taskLabelsMap.get(tid).push({ id: tl.id, name: tl.name, color: tl.color });
                });
            }

            // Attach Custom Field Values and Labels to Tasks
            const tasksWithFields = tasksWithAssignees.map(task => {
                const taskValues = customFieldValues.filter(v => v.task_id === task.id);
                const taskLabels = taskLabelsMap.get(task.id) || [];
                return {
                    ...task,
                    customFieldValues: taskValues,
                    labels: taskLabels
                };
            });

            // Re-map lists with updated tasks
            const listsWithUpdatedTasks = lists.map(list => ({
                ...list,
                tasks: tasksWithFields.filter(t => t.list_id === list.id)
            }));

            return {
                ...project,
                members: members.map(m => m.id),
                columns: listsWithUpdatedTasks,
                customFields: customFields,
                labels: labels
            };
        }));

        res.json({ success: true, projects: projectsWithDetails });
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/projects', async (req, res) => {
    const { title, description, startDate, endDate, ownerId, template, workspaceId, background } = req.body;

    // Default background if not provided
    const backgroundType = background?.type || 'color';
    const backgroundValue = background?.value || 'default';

    try {
        const [result] = await pool.execute(
            'INSERT INTO projects (title, description, start_date, end_date, owner_id, workspace_id, background_type, background_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description || null, startDate || null, endDate || null, ownerId, workspaceId || null, backgroundType, backgroundValue]
        );
        const projectId = result.insertId;

        // 2. Add Owner as Member
        await pool.execute(
            'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
            [projectId, ownerId, 'owner']
        );

        // 3. Create Default Lists based on Template
        let defaultLists = ['To Do', 'In Progress', 'Done']; // Default 'general'

        if (template === 'web_dev') {
            defaultLists = ['Backlog', 'Doing', 'Review', 'Done'];
        } else if (template === 'sales') {
            defaultLists = ['Lead', 'Contacted', 'Negotiation', 'Won'];
        }

        for (let i = 0; i < defaultLists.length; i++) {
            await pool.execute(
                'INSERT INTO project_lists (project_id, title, position) VALUES (?, ?, ?)',
                [projectId, defaultLists[i], i]
            );
        }

        res.json({ success: true, projectId });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/projects/:id/background', upload.single('file'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ success: true, filePath });
});

// --- Lists API ---

app.get('/api/projects/:id/lists', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM project_lists WHERE project_id = ? ORDER BY position ASC', [id]);
        res.json({ success: true, lists: rows });
    } catch (error) {
        console.error('Fetch lists error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/projects/:id/lists', async (req, res) => {
    const { id } = req.params; // project_id
    const { title, position } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO project_lists (project_id, title, position) VALUES (?, ?, ?)',
            [id, title, position || 0]
        );
        res.json({ success: true, listId: result.insertId });
    } catch (error) {
        console.error('Create list error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/projects/:id/lists/reorder', async (req, res) => {
    const { id } = req.params; // project_id
    const { listIds } = req.body; // Array of list IDs in new order

    if (!listIds || !Array.isArray(listIds)) {
        return res.status(400).json({ success: false, message: 'Invalid listIds' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        for (let i = 0; i < listIds.length; i++) {
            await connection.execute(
                'UPDATE project_lists SET position = ? WHERE id = ? AND project_id = ?',
                [i, listIds[i], id]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Reorder lists error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/lists/:id', async (req, res) => {
    const { id } = req.params;
    const { title, position } = req.body;
    try {
        await pool.execute(
            'UPDATE project_lists SET title = COALESCE(?, title), position = COALESCE(?, position) WHERE id = ?',
            [title !== undefined ? title : null, position !== undefined ? position : null, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update list error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/lists/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete dependencies sequentially
        await pool.execute('DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE list_id = ?)', [id]);
        await pool.execute('DELETE FROM tasks WHERE list_id = ?', [id]);
        await pool.execute('DELETE FROM project_lists WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete list error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)', [id]);
        await pool.execute('DELETE FROM tasks WHERE project_id = ?', [id]);
        await pool.execute('DELETE FROM project_lists WHERE project_id = ?', [id]); // Delete lists too
        await pool.execute('DELETE FROM project_members WHERE project_id = ?', [id]);
        await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, startDate, endDate, background, userId } = req.body; // userId required for permission check

    try {
        // 1. Permission Check
        let authorized = false;

        // Check if user is system admin? (users table -> role='admin')
        if (userId) {
            const [userRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
            if (userRows.length > 0 && userRows[0].role === 'admin') {
                authorized = true;
            }
        }

        if (!authorized && userId) {
            // Check Project Relationship
            const [proj] = await pool.execute('SELECT owner_id FROM projects WHERE id = ?', [id]);
            if (proj.length > 0 && proj[0].owner_id == userId) {
                authorized = true;
            } else {
                const [memberRows] = await pool.execute(
                    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
                    [id, userId]
                );
                if (memberRows.length > 0 && ['owner', 'admin'].includes(memberRows[0].role)) {
                    authorized = true;
                }
            }
        }

        if (!authorized) {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }

        // 2. Prepare Update fields
        const updates = [];
        const params = [];

        if (title !== undefined) { updates.push('title = ?'); params.push(title); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description || null); }
        if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate || null); }
        if (endDate !== undefined) { updates.push('end_date = ?'); params.push(endDate || null); }
        if (background) {
            updates.push('background_type = ?');
            updates.push('background_value = ?');
            params.push(background.type || 'color');
            params.push(background.value || 'default');
        }

        if (updates.length > 0) {
            params.push(id);
            await pool.execute(
                `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ success: false });
    }
});

// --- Tasks API ---

app.get('/api/projects/:projectId/tasks', async (req, res) => {
    const { projectId } = req.params;
    const { start_date, end_date, userId } = req.query;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    try {
        // 1. Permission Check (Optional strictly speaking if we trust frontend, but good practice)
        // Check if user is member of project or owner
        const [access] = await pool.execute(`
            SELECT 1 
            FROM projects p
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
            LIMIT 1
        `, [projectId, userId, userId]);

        if (access.length === 0) {
            return res.status(403).json({ success: false, message: 'Permission denied or project not found' });
        }

        // 2. Build Query
        let query = `
            SELECT t.*, 
                   DATE_FORMAT(t.deadline, '%Y-%m-%d') as deadline_str,
                   t.created_at as startDate
            FROM tasks t
            WHERE t.project_id = ?
        `;
        const params = [projectId];

        // Date Filtering Logic
        // Overlap: (TaskStart <= QueryEnd) AND (TaskEnd >= QueryStart)
        // TaskStart = t.created_at
        // TaskEnd = t.deadline (if NULL, assume infinity)
        if (start_date && end_date) {
            query += ` AND (DATE(t.created_at) <= ? AND (t.deadline IS NULL OR t.deadline >= ?))`;
            params.push(end_date, start_date);
        }

        const [tasks] = await pool.execute(query, params);

        // 3. Enrich Data (Assignees, Labels, Custom Fields) - Efficiently
        if (tasks.length > 0) {
            const taskIds = tasks.map(t => t.id);
            const placeholders = taskIds.map(() => '?').join(',');

            // Fetch Assignees
            const [assignees] = await pool.execute(
                `SELECT task_id, user_id FROM task_assignees WHERE task_id IN (${placeholders})`,
                taskIds
            );

            // Fetch Labels
            const [labels] = await pool.execute(
                `SELECT tl.task_id, l.id, l.name, l.color 
                 FROM task_labels tl
                 JOIN labels l ON tl.label_id = l.id
                 WHERE tl.task_id IN (${placeholders})`,
                taskIds
            );

            // Fetch Custom Field Values
            const [customValues] = await pool.execute(
                `SELECT * FROM custom_field_values WHERE task_id IN (${placeholders})`,
                taskIds
            );

            // Fetch Attachments count/cover (optional, but good for UI)
            const [covers] = await pool.execute(
                `SELECT task_id, file_path FROM task_attachments 
                 WHERE task_id IN (${placeholders}) AND file_type LIKE 'image/%' 
                 ORDER BY created_at DESC`, // crude way to get latest, we'll pick first in map
                taskIds
            );

            // Map helper
            const taskMap = {};
            tasks.forEach(t => {
                t.assignees = [];
                t.labels = [];
                t.customFieldValues = [];
                t.cover_image = null;
                t.deadline = t.deadline_str; // normalization
                delete t.deadline_str;
                // startDate is already created_at from query, ensure it is string if needed?
                // created_at is usually Date object. Let's format it?
                // The prompt asked for "data correction... created_at as start date". 
                // We returned it as 'startDate'.
                taskMap[t.id] = t;
            });

            assignees.forEach(r => taskMap[r.task_id]?.assignees.push(r.user_id));
            labels.forEach(r => taskMap[r.task_id]?.labels.push({ id: r.id, name: r.name, color: r.color }));
            customValues.forEach(r => taskMap[r.task_id]?.customFieldValues.push(r));

            // Just take one cover per task if exists
            const handledCovers = new Set();
            covers.forEach(r => {
                if (!handledCovers.has(r.task_id)) {
                    taskMap[r.task_id].cover_image = r.file_path;
                    handledCovers.add(r.task_id);
                }
            });
        }

        res.json({ success: true, tasks });

    } catch (error) {
        console.error('Fetch project tasks error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/projects/:id/tasks', async (req, res) => {
    const { id: projectId } = req.params;
    const { title, description, listId, deadline, assignees, labelIds, userId } = req.body;
    const status = listId; // mapping for query reuse if variable names match

    try {
        // Get max position for the list to append to bottom
        const [rows] = await pool.execute('SELECT MAX(position) as maxPos FROM tasks WHERE list_id = ?', [listId]);
        const newPosition = (rows[0].maxPos || 0) + 1; // 1-based or 0-based? Let's say max+1. If empty 0+1=1. Actually 65535 works too like Trello.
        // Let's stick to integer increment for now.

        // 1. Create Task
        const [result] = await pool.execute(
            'INSERT INTO tasks (project_id, title, description, list_id, deadline, position) VALUES (?, ?, ?, ?, ?, ?)',
            [projectId, title, description || null, status, deadline || null, newPosition]
        );
        const taskId = result.insertId;

        // 2. Add Assignees
        if (assignees && assignees.length > 0) {
            const assigneeValues = assignees.map(userId => [taskId, userId]);
            await pool.query(
                'INSERT INTO task_assignees (task_id, user_id) VALUES ?',
                [assigneeValues]
            );
        }

        // 3. Add Labels
        if (labelIds && labelIds.length > 0) {
            const labelValues = labelIds.map(lid => [taskId, lid]);
            await pool.query(
                'INSERT INTO task_labels (task_id, label_id) VALUES ?',
                [labelValues]
            );
        }

        // 3. Custom Field Values
        if (req.body.customFieldValues && typeof req.body.customFieldValues === 'object') {
            const values = req.body.customFieldValues;
            for (const [fieldId, value] of Object.entries(values)) {
                // Determine if we need to store value_text or value_number based on type
                // But for simplicity/unification, we might check field type or store as text if generic?
                // The DB schema for custom_field_values has value_text, value_number, value_date (implied or check schema)
                // Let's check schema assumption.
                // Assuming simple schema: mostly value_text or generic.
                // If the table separates them, we need to know the type.
                // If we don't have types here, we might just store everything in value_text for now if schema allows, 
                // OR we fetch definitions first. 
                // Let's assume the previous implementation of saveCustomFieldValue handles it. 
                // Let's check how saveCustomFieldValue is implemented in server.
                // Wait, if I don't know the type, I can't put it in the right column if strict.
                // Let's look up the field definition or just try access saving endpoint logic.
                // Better: Fetch field types for these IDs.

                // The DB schema uses field_definition_id and a single 'value' column (Text).
                // We don't need to distinguish type for storage, just store as string.
                await pool.execute(
                    'INSERT INTO custom_field_values (task_id, field_definition_id, value) VALUES (?, ?, ?)',
                    [taskId, fieldId, String(value)]
                );
            }
        }

        // Event: TASK_CREATED
        // We need actorName. Frontend should send it or we query.
        const [users] = await pool.execute('SELECT name FROM users WHERE id = ?', [userId]);
        const actorName = users[0]?.name || 'Unknown';

        // Fetch user data for assignees to render avatars immediately
        let assigneeDetails = [];
        if (assignees && assignees.length > 0) {
            const [details] = await pool.query(`SELECT id, name, avatar FROM users WHERE id IN (?)`, [assignees]);
            assigneeDetails = details;
        }

        await eventService.emit('TASK_CREATED', {
            projectId,
            taskId,
            title,
            description,
            listId,
            deadline: deadline || null,
            assignees: assigneeDetails,
            labelIds: labelIds || [],
            actorName
        });

        res.json({ success: true, taskId });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Move Task API (DnD)
app.put('/api/tasks/:id/move', async (req, res) => {
    const { id } = req.params; // taskId
    const { listId, newPosition, userId } = req.body;

    if (!listId || newPosition === undefined) {
        return res.status(400).json({ success: false, message: 'Missing listId or newPosition' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Transaction for safety
        await connection.beginTransaction();

        // 1. Get current info
        const [tasks] = await connection.execute('SELECT list_id, position FROM tasks WHERE id = ?', [id]);
        if (tasks.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        const currentListId = tasks[0].list_id;
        const currentPosition = tasks[0].position;

        // 2. Logic
        if (currentListId === listId) {
            // Same list: reorder
            if (currentPosition < newPosition) {
                // Moved down: shift items between old and new UP (-1)
                await connection.execute(
                    'UPDATE tasks SET position = position - 1 WHERE list_id = ? AND position > ? AND position <= ?',
                    [listId, currentPosition, newPosition]
                );
            } else if (currentPosition > newPosition) {
                // Moved up: shift items between new and old DOWN (+1)
                await connection.execute(
                    'UPDATE tasks SET position = position + 1 WHERE list_id = ? AND position >= ? AND position < ?',
                    [listId, newPosition, currentPosition]
                );
            }
            // Update target
            await connection.execute('UPDATE tasks SET position = ? WHERE id = ?', [newPosition, id]);

        } else {
            // Different list
            // 1. Shift items in OLD list UP (-1) to close gap
            await connection.execute(
                'UPDATE tasks SET position = position - 1 WHERE list_id = ? AND position > ?',
                [currentListId, currentPosition]
            );

            // 2. Shift items in NEW list DOWN (+1) to make space
            await connection.execute(
                'UPDATE tasks SET position = position + 1 WHERE list_id = ? AND position >= ?',
                [listId, newPosition]
            );

            // 3. Update target task
            await connection.execute('UPDATE tasks SET list_id = ?, position = ? WHERE id = ?', [listId, newPosition, id]);

            if (req.body.userId) {
                const [targetList] = await connection.execute('SELECT title FROM project_lists WHERE id = ?', [listId]);
                const listTitle = targetList[0]?.title || 'another list';

                await logActivity(connection, id, req.body.userId, `moved this task to ${listTitle}`);

                // Event: TASK_MOVED
                const [proj] = await connection.execute('SELECT project_id FROM tasks WHERE id = ?', [id]);
                if (proj.length > 0) {
                    await eventService.emit('TASK_MOVED', {
                        projectId: proj[0].project_id,
                        taskId: id,
                        listId,
                        newPosition,
                        userId: req.body.userId,
                        listTitle
                    }, connection);
                }
            }
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Move task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        if (connection) connection.release();
    }
});


app.get('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch Task Details (with deadline formatted)
        const [rows] = await pool.execute(
            `SELECT t.*, DATE_FORMAT(t.deadline, '%Y-%m-%d') as deadline 
             FROM tasks t WHERE t.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        const task = rows[0];

        // 2. Fetch Assignees
        const [assignees] = await pool.execute(
            `SELECT u.id, u.name, u.avatar 
             FROM task_assignees ta 
             JOIN users u ON ta.user_id = u.id 
             WHERE ta.task_id = ?`,
            [id]
        );

        // 3. Fetch Labels
        const [labels] = await pool.execute(
            `SELECT l.id, l.name, l.color 
             FROM task_labels tl 
             JOIN labels l ON tl.label_id = l.id 
             WHERE tl.task_id = ?`,
            [id]
        );

        // 4. Fetch Custom Field Values
        const [customFieldValues] = await pool.execute(
            'SELECT * FROM custom_field_values WHERE task_id = ?',
            [id]
        );

        res.json({
            success: true,
            task: {
                ...task,
                assignees: assignees,
                labels: labels,
                customFieldValues: customFieldValues
            }
        });

    } catch (error) {
        console.error('Fetch task details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, listId, deadline, assignees } = req.body;

    try {
        // 1. Fetch current task to compare for logs and handle empty deadline
        const [currentRows] = await pool.execute("SELECT *, DATE_FORMAT(deadline, '%Y-%m-%d') as deadline_str FROM tasks WHERE id = ?", [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        const currentTask = currentRows[0];

        // Sanitize deadline
        let safeDeadline = deadline;
        if (safeDeadline === '') safeDeadline = null;

        // 2. Diff for Logging
        const userId = req.body.userId;
        const changes = [];

        // Helper to normalize strings for comparison
        const normalize = (str) => String(str || '').trim();

        // Check if provided AND different
        if (title !== undefined && normalize(title) !== normalize(currentTask.title)) changes.push('title');

        if (description !== undefined && normalize(description) !== normalize(currentTask.description)) changes.push('description');

        // Deadline compare
        let deadlineChanged = false;
        if (safeDeadline !== undefined) {
            const currentD = currentTask.deadline_str || null;
            if (safeDeadline !== currentD) {
                changes.push('deadline');
                deadlineChanged = true;
            }
        }

        // 3. Update Task Details
        const updateFields = [];
        const updateValues = [];

        if (title !== undefined) { updateFields.push('title = ?'); updateValues.push(title); }
        if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description); }
        if (listId !== undefined) { updateFields.push('list_id = ?'); updateValues.push(listId); }

        if (req.body.deadline !== undefined) {
            updateFields.push('deadline = ?');
            updateValues.push(safeDeadline);
        }

        if (updateFields.length > 0) {
            updateValues.push(id);
            await pool.execute(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
        }

        // 4. Update Assignees (if provided) 
        if (assignees !== undefined) {
            const [currAssignees] = await pool.execute('SELECT user_id FROM task_assignees WHERE task_id = ?', [id]);
            const currIds = currAssignees.map(r => r.user_id).sort((a, b) => a - b).join(',');
            const newIds = assignees.map(v => parseInt(v)).sort((a, b) => a - b).join(',');

            if (currIds !== newIds) {
                changes.push('assignees');
                await pool.execute('DELETE FROM task_assignees WHERE task_id = ?', [id]);
                if (assignees.length > 0) {
                    const assigneeValues = assignees.map(userId => [id, userId]);
                    await pool.query(
                        'INSERT INTO task_assignees (task_id, user_id) VALUES ?',
                        [assigneeValues]
                    );

                    // Notify new assignees -> Moved to EventService
                    // Just updating DB here.
                }
            }
        }

        // 5. Log Activity & Notifications
        // 5. Log Activity & Notifications & Broadcast
        if (userId && changes.length > 0) {
            await logActivity(pool, id, userId, `updated the task: ${changes.join(', ')}`);
        }

        const [proj] = await pool.execute('SELECT project_id, title FROM tasks WHERE id = ?', [id]);
        if (proj.length > 0) {
            // Determine new assignees
            let newAssignees = [];
            if (assignees !== undefined) {
                // Re-fetch to be accurate or calculate locally?
                // Simple approach: pass "assignees" (list of IDs) and let Service filter 'new' ones if it wants?
                // Or calculate 'new' here.
                // Service logic: "if assignees provided, check diff". 
                // Let's pass simple data and let Service handle notifications if we want to move logic there.
                // BUT, user asked to "remove complex logic from controller".
                // So we should calculate critical data here or move data fetching to service.
                // Moving data fetching to service might duplicate queries.
                // Let's pass the "changes" array.
                if (changes.includes('assignees')) {
                    // We passed 'assignees' array in body.
                    // The logic for notifying *new* users was in controller.
                    // Let's move that to EventService.handleTaskUpdated.
                    // We need to pass the FULL list of current assignees? No, just the new targeting list.
                    // Actually, the previous logic was: "notify if in new list AND not in old list".
                    // We already did the DB update. 
                    // Let's calculate `newIds` (the array) and pass it to event.
                    newAssignees = assignees; // The array of IDs passed in body
                }
            }

            // Task Title for notifications
            const taskTitle = proj[0].title;

            // Construct updates object for frontend
            const updates = {};
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (listId !== undefined) updates.list_id = listId;
            if (req.body.deadline !== undefined) updates.deadline = safeDeadline; // YYYY-MM-DD or null

            await eventService.emit('TASK_UPDATED', {
                projectId: proj[0].project_id,
                taskId: id,
                changes,
                updates, // Pass the new values
                assignees: { new: newAssignees }, // Pass potentially new assignees
                taskTitle
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM task_comments WHERE task_id = ?', [id]); // Cascade delete
        await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Comments & Activity Logs API ---

// Get comments for a task
app.get('/api/tasks/:id/comments', async (req, res) => {
    const { id } = req.params;

    // Prevent Caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    try {
        const [rows] = await pool.execute(`
            SELECT c.*, u.name as user_name, u.avatar 
            FROM task_comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `, [id]);
        res.json({ success: true, comments: rows });
    } catch (error) {
        console.error('Fetch comments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/tasks/:id/comments', async (req, res) => {
    const { id } = req.params;
    const { userId, content, type = 'comment' } = req.body;

    if (!userId || !content) {
        return res.status(400).json({ success: false, message: 'Missing userId or content' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO task_comments (task_id, user_id, content, type) VALUES (?, ?, ?, ?)',
            [id, userId, content, type]
        );

        // Fetch the new comment to return fully populated
        const [rows] = await pool.execute(`
            SELECT c.*, u.name as user_name, u.avatar 
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [result.insertId]);

        const newComment = rows[0];

        // Event: COMMENT_ADDED
        // Need to calculate assigneesToNotify
        const [assignees] = await pool.execute('SELECT user_id FROM task_assignees WHERE task_id = ?', [id]);
        const assigneesToNotify = assignees.map(a => a.user_id).filter(uid => uid !== userId);

        const [taskInfo] = await pool.execute('SELECT title, project_id FROM tasks WHERE id = ?', [id]);
        if (taskInfo.length > 0) {
            await eventService.emit('COMMENT_ADDED', {
                projectId: taskInfo[0].project_id,
                taskId: id,
                comment: newComment,
                assigneesToNotify
            }); // eventService handles implicit pool

            // Check Urgent
            const [urgentLabels] = await pool.execute(
                `SELECT l.id FROM labels l
                 JOIN task_labels tl ON l.id = tl.label_id
                 WHERE tl.task_id = ? AND (l.name = 'Urgent' OR l.name = '긴급')`,
                [id]
            );

            if (urgentLabels.length > 0) {
                await eventService.emit('URGENT_COMMENT', {
                    projectId: taskInfo[0].project_id,
                    actorName: newComment.user_name,
                    taskTitle: taskInfo[0].title
                });
            }
        }

        res.json({ success: true, comment: newComment });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Checklists API ---

app.get('/api/tasks/:taskId/checklists', async (req, res) => {
    const { taskId } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM task_checklists WHERE task_id = ? ORDER BY position ASC, created_at ASC', [taskId]);
        res.json({ success: true, checklists: rows });
    } catch (error) {
        console.error('Fetch checklists error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/checklists', async (req, res) => {
    const { taskId, content } = req.body;
    if (!taskId || !content) {
        return res.status(400).json({ success: false, message: 'Missing taskId or content' });
    }

    try {
        // Get max position
        const [rows] = await pool.execute('SELECT MAX(position) as maxPos FROM task_checklists WHERE task_id = ?', [taskId]);
        const newPosition = (rows[0].maxPos || 0) + 1;

        const [result] = await pool.execute(
            'INSERT INTO task_checklists (task_id, content, position) VALUES (?, ?, ?)',
            [taskId, content, newPosition]
        );

        const [newItem] = await pool.execute('SELECT * FROM task_checklists WHERE id = ?', [result.insertId]);

        // Event: CHECKLIST_UPDATED
        const [taskRow] = await pool.execute('SELECT project_id FROM tasks WHERE id = ?', [taskId]);
        if (taskRow.length > 0) {
            await eventService.emit('CHECKLIST_UPDATED', {
                projectId: taskRow[0].project_id,
                taskId,
                checklist: newItem[0]
            });
        }

        res.json({ success: true, checklist: newItem[0] });
    } catch (error) {
        console.error('Create checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.patch('/api/checklists/:id', async (req, res) => {
    const { id } = req.params;
    const { content, isCompleted } = req.body;

    try {
        await pool.execute(`
            UPDATE task_checklists 
            SET content = COALESCE(?, content), 
                is_completed = COALESCE(?, is_completed) 
            WHERE id = ?
        `, [
            content !== undefined ? content : null,
            isCompleted !== undefined ? isCompleted : null,
            id
        ]);

        const [updatedItem] = await pool.execute('SELECT * FROM task_checklists WHERE id = ?', [id]);
        res.json({ success: true, checklist: updatedItem[0] });
    } catch (error) {
        console.error('Update checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/checklists/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM task_checklists WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete checklist error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- Attachment Endpoints ---

// Upload a file
app.post('/api/tasks/:taskId/attachments', upload.single('file'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        // Save metadata to DB
        // File path: for client access, it's relative: '/uploads/' + filename
        const fileUrl = '/uploads/' + file.filename;

        const [result] = await pool.execute(
            'INSERT INTO task_attachments (task_id, file_name, file_path, file_size, file_type) VALUES (?, ?, ?, ?, ?)',
            [taskId, file.originalname, fileUrl, file.size, file.mimetype]
        );

        res.status(201).json({
            id: result.insertId,
            fileName: file.originalname,
            filePath: fileUrl,
            size: file.size,
            type: file.mimetype,
            created_at: new Date()
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
});

// Get attachments for a task
app.get('/api/tasks/:taskId/attachments', async (req, res) => {
    try {
        const { taskId } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC',
            [taskId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching attachments:', error);
        res.status(500).json({ error: 'Failed to fetch attachments.' });
    }
});

// Delete attachment
app.delete('/api/attachments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Get file info first
        const [rows] = await pool.execute('SELECT * FROM task_attachments WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Attachment not found.' });
        }

        const attachment = rows[0];
        const filename = attachment.file_path.replace('/uploads/', '');
        const filePath = path.join(uploadDir, filename);

        // Delete from DB
        await pool.execute('DELETE FROM task_attachments WHERE id = ?', [id]);

        // Delete from FS
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Attachment deleted successfully.' });

    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ error: 'Failed to delete attachment.' });
    }
});

// Helper to log activity
async function logActivity(connection, taskId, userId, content) {
    // userId might be null if action is system/auto? 
    // Ideally we pass the acting user. For move/update we should expect userId in body or req.
    // Ensure userId is valid, or use a system user ID if implementing that.
    // For now, if no userId, we might skip or use owner.
    if (!userId) return;

    try {
        await connection.execute(
            'INSERT INTO task_comments (task_id, user_id, content, type) VALUES (?, ?, ?, ?)',
            [taskId, userId, content, 'activity']
        );
    } catch (e) {
        console.error('Failed to log activity:', e);
    }
}
// --- Custom Fields API ---

app.get('/api/projects/:id/custom-fields', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM custom_field_definitions WHERE project_id = ? ORDER BY position ASC', [id]);
        res.json({ success: true, fields: rows });
    } catch (error) {
        console.error('Fetch custom fields error:', error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/projects/:id/custom-fields', async (req, res) => {
    const { id } = req.params;
    const { name, type, position } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO custom_field_definitions (project_id, name, type, position) VALUES (?, ?, ?, ?)',
            [id, name, type || 'text', position || 0]
        );
        res.json({ success: true, fieldId: result.insertId });
    } catch (error) {
        console.error('Create custom field error:', error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/custom-fields/:id', async (req, res) => {
    const { id } = req.params;
    const { name, type, position } = req.body;
    try {
        await pool.execute(
            'UPDATE custom_field_definitions SET name = ?, type = ?, position = ? WHERE id = ?',
            [name, type, position, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update custom field error:', error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/custom-fields/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM custom_field_definitions WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete custom field error:', error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/tasks/:taskId/custom-fields', async (req, res) => {
    const { taskId } = req.params;
    const { fieldId, value } = req.body;
    try {
        const [existing] = await pool.execute(
            'SELECT id FROM custom_field_values WHERE task_id = ? AND field_definition_id = ?',
            [taskId, fieldId]
        );

        if (existing.length > 0) {
            await pool.execute(
                'UPDATE custom_field_values SET value = ? WHERE id = ?',
                [value, existing[0].id]
            );
        } else {
            await pool.execute(
                'INSERT INTO custom_field_values (task_id, field_definition_id, value) VALUES (?, ?, ?)',
                [taskId, fieldId, value]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Update custom field value error:', error);
        res.status(500).json({ success: false });
    }
});

// --- Labels API ---

app.get('/api/projects/:id/labels', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute('SELECT * FROM labels WHERE project_id = ? ORDER BY position ASC', [id]);
        res.json({ success: true, labels: rows });
    } catch (error) {
        console.error('Fetch labels error:', error);
        res.status(500).json({ success: false });
    }
});

app.post('/api/projects/:id/labels', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        // Get max position
        const [rows] = await pool.execute('SELECT MAX(position) as maxPos FROM labels WHERE project_id = ?', [id]);
        const newPos = (rows[0].maxPos || 0) + 1;

        const [result] = await pool.execute(
            'INSERT INTO labels (project_id, name, color, position) VALUES (?, ?, ?, ?)',
            [id, name, color, newPos]
        );
        res.json({ success: true, label: { id: result.insertId, project_id: id, name, color, position: newPos } });
    } catch (error) {
        console.error('Create label error:', error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/labels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        await pool.execute(
            'UPDATE labels SET name = ?, color = ? WHERE id = ?',
            [name, color, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Update label error:', error);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/labels/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM labels WHERE id = ?', [id]); // On delete cascade handles task_labels
        res.json({ success: true });
    } catch (error) {
        console.error('Delete label error:', error);
        res.status(500).json({ success: false });
    }
});

// Update Task Labels (Assign/Unassign)
app.post('/api/tasks/:id/labels', async (req, res) => {
    let connection;
    try {
        const { id } = req.params; // taskId
        const { labelIds } = req.body; // Array of label IDs
        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Clear existing
        await connection.execute('DELETE FROM task_labels WHERE task_id = ?', [id]);

        // Insert new
        if (labelIds && labelIds.length > 0) {
            const values = labelIds.map(lid => [id, lid]);
            await connection.query('INSERT INTO task_labels (task_id, label_id) VALUES ?', [values]);
        }

        await connection.commit();

        // Fetch updated labels to return
        const [labels] = await connection.execute(`
            SELECT l.* FROM labels l
            JOIN task_labels tl ON l.id = tl.label_id
            WHERE tl.task_id = ?
        `, [id]);

        res.json({ success: true, labels });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update task labels error:', error);
        res.status(500).json({ success: false });
    } finally {
        if (connection) connection.release();
    }
});

// --- Bulk Actions API ---
app.patch('/api/tasks/bulk-update', async (req, res) => {
    const { taskIds, updates } = req.body; // taskIds: [], updates: { listId, assignees, labels, delete: true, assigneeMode, labelMode }
    const { userId } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No tasks selected' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Bulk Delete
        if (updates.delete || updates.action === 'delete') {
            const placeholders = taskIds.map(() => '?').join(',');
            await connection.query(`DELETE FROM tasks WHERE id IN (${placeholders})`, taskIds);

            await connection.commit();
            io.emit('tasksBulkUpdated'); // Notify all clients
            return res.json({ success: true, message: `Deleted ${taskIds.length} tasks` });
        }

        // 2. Bulk Move (List)
        if (updates.listId) {
            // Check if target list is "Done"
            const [lists] = await connection.execute('SELECT title FROM project_lists WHERE id = ?', [updates.listId]);
            const listTitle = lists[0]?.title || '';
            const isDone = ['done', 'completed', '완료'].includes(listTitle.toLowerCase());

            const placeholders = taskIds.map(() => '?').join(',');

            if (isDone) {
                // Set deadline to NOW()
                await connection.query(
                    `UPDATE tasks SET list_id = ?, deadline = NOW() WHERE id IN (${placeholders})`,
                    [updates.listId, ...taskIds]
                );
            } else {
                await connection.query(
                    `UPDATE tasks SET list_id = ? WHERE id IN (${placeholders})`,
                    [updates.listId, ...taskIds]
                );
            }
        }

        // 3. Bulk Assignees
        // Mode: 'add' (append), 'replace' (overwrite), 'remove' (remove specific)
        if (updates.assignees && Array.isArray(updates.assignees)) {
            const mode = updates.assigneeMode || 'replace';

            if (mode === 'replace') {
                // Delete existing
                const placeholders = taskIds.map(() => '?').join(',');
                await connection.query(`DELETE FROM task_assignees WHERE task_id IN (${placeholders})`, taskIds);

                // Insert new
                if (updates.assignees.length > 0) {
                    const values = [];
                    taskIds.forEach(taskId => {
                        updates.assignees.forEach(userId => {
                            values.push([taskId, userId]);
                        });
                    });
                    await connection.query('INSERT INTO task_assignees (task_id, user_id) VALUES ?', [values]);
                }
            } else if (mode === 'add') {
                const values = [];
                taskIds.forEach(taskId => {
                    updates.assignees.forEach(userId => {
                        values.push([taskId, userId]);
                    });
                });
                if (values.length > 0) {
                    await connection.query('INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES ?', [values]);
                }
            } else if (mode === 'remove') {
                if (updates.assignees.length > 0) {
                    const userPlaceholders = updates.assignees.map(() => '?').join(',');
                    const taskPlaceholders = taskIds.map(() => '?').join(',');
                    await connection.query(
                        `DELETE FROM task_assignees WHERE task_id IN (${taskPlaceholders}) AND user_id IN (${userPlaceholders})`,
                        [...taskIds, ...updates.assignees]
                    );
                }
            }
        }

        // 4. Bulk Labels
        if (updates.labels && Array.isArray(updates.labels)) {
            const mode = updates.labelMode || 'replace';
            // 'replace', 'add', 'remove'

            if (mode === 'replace') {
                const placeholders = taskIds.map(() => '?').join(',');
                await connection.query(`DELETE FROM task_labels WHERE task_id IN (${placeholders})`, taskIds);

                if (updates.labels.length > 0) {
                    const values = [];
                    taskIds.forEach(taskId => {
                        updates.labels.forEach(labelId => {
                            values.push([taskId, labelId]);
                        });
                    });
                    await connection.query('INSERT INTO task_labels (task_id, label_id) VALUES ?', [values]);
                }
            } else if (mode === 'add') {
                const values = [];
                taskIds.forEach(taskId => {
                    updates.labels.forEach(labelId => {
                        values.push([taskId, labelId]);
                    });
                });
                if (values.length > 0) {
                    await connection.query('INSERT IGNORE INTO task_labels (task_id, label_id) VALUES ?', [values]);
                }
            } else if (mode === 'remove') {
                if (updates.labels.length > 0) {
                    const labelPlaceholders = updates.labels.map(() => '?').join(',');
                    const taskPlaceholders = taskIds.map(() => '?').join(',');
                    await connection.query(
                        `DELETE FROM task_labels WHERE task_id IN (${taskPlaceholders}) AND label_id IN (${labelPlaceholders})`,
                        [...taskIds, ...updates.labels]
                    );
                }
            }
        }

        await connection.commit();

        // Notify clients
        io.emit('tasksBulkUpdated');

        res.json({ success: true, message: 'Bulk update successful' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Bulk update error:', error);
        res.status(500).json({ success: false, message: 'Bulk update failed' });
    } finally {
        if (connection) connection.release();
    }
});

// --- Statistics API ---
app.get('/api/projects/:id/stats', async (req, res) => {
    const { id: projectId } = req.params;

    try {
        // 1. Fetch Project Lists (Columns) to identify "Done" status
        // Heuristic: The list named "Done" (case-insensitive) or the last list by position.
        const [lists] = await pool.execute('SELECT id, title FROM project_lists WHERE project_id = ? ORDER BY position ASC', [projectId]);

        let doneListId = null;
        let doneListTitle = '';
        if (lists.length > 0) {
            const doneList = lists.find(l => l.title.toLowerCase() === 'done' || l.title.toLowerCase() === 'completed') || lists[lists.length - 1];
            doneListId = doneList.id;
            doneListTitle = doneList.title;
        }

        // 2. Column Stats (Tasks per list)
        const [colStats] = await pool.execute(`
            SELECT pl.title, COUNT(t.id) as count
            FROM project_lists pl
            LEFT JOIN tasks t ON pl.id = t.list_id
            WHERE pl.project_id = ?
            GROUP BY pl.id, pl.title
            ORDER BY pl.position ASC
        `, [projectId]);

        // 3. Assignee Stats (Completed vs Active)
        // We need to fetch all task-assignee pairs and their task status (list_id)
        const [assigneeRows] = await pool.execute(`
            SELECT u.id, u.name, t.list_id
            FROM users u
            JOIN task_assignees ta ON u.id = ta.user_id
            JOIN tasks t ON ta.task_id = t.id
            WHERE t.project_id = ?
        `, [projectId]);

        const assigneeStatsMap = {};
        assigneeRows.forEach(row => {
            if (!assigneeStatsMap[row.name]) {
                assigneeStatsMap[row.name] = { id: row.id, name: row.name, completed: 0, active: 0 };
            }
            if (row.list_id === doneListId) {
                assigneeStatsMap[row.name].completed++;
            } else {
                assigneeStatsMap[row.name].active++;
            }
        });

        const assigneeStats = Object.values(assigneeStatsMap).map(stat => ({
            ...stat,
            total: stat.completed + stat.active,
            ratio: (stat.completed + stat.active) > 0 ? Math.round((stat.completed / (stat.completed + stat.active)) * 100) : 0
        }));

        // 4. Label Stats
        const [labelRows] = await pool.execute(`
            SELECT l.name, l.color, COUNT(tl.task_id) as count
            FROM labels l
            LEFT JOIN task_labels tl ON l.id = tl.label_id
            JOIN tasks t ON tl.task_id = t.id
            WHERE t.project_id = ?
            GROUP BY l.id
        `, [projectId]);

        // 5. Burndown Chart Data (Cumulative Completed Tasks by Date)
        // Method: Analyze activity logs (task_comments) for "moved to [DoneListTitle]".
        // Also include tasks currently in "Done" that might lack logs (migration? or created in Done? though unlikely)
        // For accurate burndown, we rely on logs.

        // Fetch logs
        const [logs] = await pool.execute(`
            SELECT DATE(c.created_at) as date, c.content
            FROM task_comments c
            JOIN tasks t ON c.task_id = t.id
            WHERE t.project_id = ? AND c.type = 'activity' AND c.content LIKE ?
            ORDER BY c.created_at ASC
        `, [projectId, `%moved this task to ${doneListTitle}%`]);

        // Generate date range from Project Start (or first log) to Today
        // Get project start date
        const [projectInfo] = await pool.execute('SELECT start_date, created_at FROM projects WHERE id = ?', [projectId]);
        const startDateSrc = projectInfo[0]?.start_date || projectInfo[0]?.created_at || new Date();
        const startDate = new Date(startDateSrc);
        const today = new Date(); // Server time (local)

        // Map logs to counts
        const dailyCompleted = {};
        logs.forEach(log => {
            // log.date is usually a Date object or string 'YYYY-MM-DD' depending on driver
            // mysql2 returns Date object for DATE() query usually? check.
            // If DATE() function used, it might return string.
            // Safe robust handling:
            const d = new Date(log.date);
            const key = d.toISOString().split('T')[0];
            dailyCompleted[key] = (dailyCompleted[key] || 0) + 1;
        });

        // Build Cumulative Series
        const burndownData = [];
        let cumulative = 0;

        // Iterate dates
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const count = dailyCompleted[dateStr] || 0;
            cumulative += count;
            burndownData.push({
                date: dateStr,
                completed: cumulative
            });
        }

        res.json({
            success: true,
            columnStats: colStats, // [{title, count}, ...]
            assigneeStats: assigneeStats, // [{name, completed, active, ratio}, ...]
            labelStats: labelRows, // [{name, color, count}, ...]
            burndownData: burndownData // [{date, completed}, ...]
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

// --- Public Sharing & Export API ---

const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

// Toggle Public Sharing
app.patch('/api/projects/:id/share', async (req, res) => {
    const { id } = req.params;
    const { isPublic } = req.body;
    const { userId } = req.body; // In real app, get from auth middleware

    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let connection;
    try {
        // Check permissions (Owner only for sharing settings?)
        const [projects] = await pool.execute('SELECT owner_id, public_token FROM projects WHERE id = ?', [id]);
        if (projects.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        if (projects[0].owner_id !== userId) {
            // Check if admin? For now owner only is safer for public sharing
            return res.status(403).json({ success: false, message: 'Only owner can change sharing settings' });
        }

        let publicToken = projects[0].public_token;

        if (isPublic) {
            if (!publicToken) {
                // Generate Token
                publicToken = crypto.randomUUID();
            }
            await pool.execute('UPDATE projects SET is_public = TRUE, public_token = ? WHERE id = ?', [publicToken, id]);
        } else {
            await pool.execute('UPDATE projects SET is_public = FALSE WHERE id = ?', [id]);
        }

        res.json({ success: true, isPublic, publicToken });
    } catch (error) {
        console.error('Share toggle error:', error);
        res.status(500).json({ success: false });
    }

});

// Get Public Project
app.get('/api/public/projects/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Find project
        const [projects] = await pool.execute('SELECT * FROM projects WHERE public_token = ? AND is_public = TRUE', [token]);

        if (projects.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found or private' });
        }

        const project = projects[0];

        // Get Lists
        const [lists] = await pool.execute('SELECT * FROM project_lists WHERE project_id = ? ORDER BY position ASC', [project.id]);

        // Get Tasks
        const [tasks] = await pool.execute(`
            SELECT t.*, 
                   DATE_FORMAT(t.deadline, '%Y-%m-%d') as deadline,
                   (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id) as checklist_total,
                   (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id AND is_completed = TRUE) as checklist_done,
                   (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count,
                   (SELECT file_path FROM task_attachments WHERE task_id = t.id AND file_type LIKE 'image/%' ORDER BY created_at DESC LIMIT 1) as cover_image
            FROM tasks t 
            WHERE t.project_id = ?
        `, [project.id]);

        // Get Labels
        const [labels] = await pool.execute('SELECT * FROM labels WHERE project_id = ?', [project.id]);

        // Enrich Tasks efficiently
        const taskIds = tasks.map(t => t.id);
        let taskLabelsMap = new Map();
        let assigneesMap = new Map();

        if (taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');

            // Labels
            const [tLabels] = await pool.execute(
                `SELECT tl.task_id, l.id, l.name, l.color 
                 FROM task_labels tl 
                 JOIN labels l ON tl.label_id = l.id 
                 WHERE tl.task_id IN (${placeholders})`,
                taskIds
            );
            tLabels.forEach(tl => {
                if (!taskLabelsMap.has(tl.task_id)) taskLabelsMap.set(tl.task_id, []);
                taskLabelsMap.get(tl.task_id).push(tl);
            });

            // Assignees
            const [tAssignees] = await pool.execute(
                `SELECT ta.task_id, u.name, u.avatar
                 FROM task_assignees ta
                 JOIN users u ON ta.user_id = u.id
                 WHERE ta.task_id IN (${placeholders})`,
                taskIds
            );
            tAssignees.forEach(ta => {
                if (!assigneesMap.has(ta.task_id)) assigneesMap.set(ta.task_id, []);
                assigneesMap.get(ta.task_id).push({ name: ta.name, avatar: ta.avatar });
            });
        }

        const tasksWithData = tasks.map(t => ({
            ...t,
            labels: taskLabelsMap.get(t.id) || [],
            assignees: assigneesMap.get(t.id) || []
        }));

        const listsWithTasks = lists.map(l => ({
            ...l,
            tasks: tasksWithData.filter(t => t.list_id === l.id)
        }));

        res.json({
            success: true,
            project: {
                ...project,
                columns: listsWithTasks,
                labels: labels,
                readOnly: true
            }
        });

    } catch (error) {
        console.error('Public fetch error:', error);
        res.status(500).json({ success: false });
    }

});


// Export API - CSV
app.get('/api/projects/:id/export/csv', async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch project info for filename
        const [projects] = await pool.execute('SELECT title FROM projects WHERE id = ?', [id]);
        if (projects.length === 0) {
            return res.status(404).send('Project not found');
        }
        const projectTitle = projects[0].title;

        // Fetch Tasks (Simple)
        const [tasks] = await pool.execute(`
            SELECT t.title, t.description, t.deadline, pl.title as list_title
            FROM tasks t
            LEFT JOIN project_lists pl ON t.list_id = pl.id
            WHERE t.project_id = ?
        `, [id]);

        const fields = ['title', 'description', 'list_title', 'deadline'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(tasks);

        // Filename construction
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
        const sanitizedTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${sanitizedTitle}_${dateStr}.csv`;
        const encodedFilename = encodeURIComponent(filename);

        res.header('Content-Type', 'text/csv');
        res.header('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.send(csv);

    } catch (error) {
        console.error('CSV Export Error:', error);
        res.status(500).send('Export failed: ' + error.message);
    }

});

// Export API - PDF
app.get('/api/projects/:id/export/pdf', async (req, res) => {
    const { id } = req.params;

    try {
        const [projects] = await pool.execute('SELECT title FROM projects WHERE id = ?', [id]);
        if (projects.length === 0) return res.status(404).send('Project not found');
        const projectTitle = projects[0].title;

        // Get Tasks
        const [tasks] = await pool.execute(`
            SELECT t.title, pl.title as list_title
            FROM tasks t
            LEFT JOIN project_lists pl ON t.list_id = pl.id
            WHERE t.project_id = ?
            ORDER BY pl.position, t.position
        `, [id]);


        // PDF Generation
        const doc = new PDFDocument();

        // Filename construction
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
        const sanitizedTitle = projectTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${sanitizedTitle}_${dateStr}.pdf`;
        const encodedFilename = encodeURIComponent(filename);

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        doc.pipe(res);


        doc.pipe(res);

        // Register Korean Font
        const fontPath = '/System/Library/Fonts/Supplemental/AppleGothic.ttf';
        try {
            doc.font(fontPath);
        } catch (e) {
            console.warn("Could not load Korean font, falling back to standard.");
        }

        doc.fontSize(20).text(`Project Report: ${projectTitle}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        doc.text(`Total Tasks: ${tasks.length}`);
        doc.moveDown();

        // Group by list
        const tasksByList = {};
        tasks.forEach(t => {
            if (!tasksByList[t.list_title]) tasksByList[t.list_title] = [];
            tasksByList[t.list_title].push(t);
        });

        Object.keys(tasksByList).forEach(list => {
            doc.fontSize(14).text(`[ ${list} ]`);
            tasksByList[list].forEach(t => {
                doc.fontSize(10).text(` - ${t.title}`);
            });
            doc.moveDown();
        });

        doc.end();

    } catch (error) {
        console.error('PDF Export Error:', error);
        if (!res.headersSent) res.status(500).send('Export failed');
    }

});


// --- Automation Rules API ---

// Get Rules
app.get('/api/projects/:id/rules', async (req, res) => {
    const { id } = req.params;
    try {
        const [rules] = await pool.execute(
            'SELECT * FROM automation_rules WHERE project_id = ? ORDER BY created_at DESC',
            [id]
        );
        res.json({ success: true, rules });
    } catch (error) {
        console.error('Fetch rules error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create Rule
app.post('/api/projects/:id/rules', async (req, res) => {
    const { id } = req.params;
    const { trigger_event, trigger_condition, action_type, action_data } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO automation_rules (project_id, trigger_event, trigger_condition, action_type, action_data) VALUES (?, ?, ?, ?, ?)',
            [id, trigger_event, JSON.stringify(trigger_condition), action_type, JSON.stringify(action_data)]
        );
        res.json({ success: true, ruleId: result.insertId });
    } catch (error) {
        console.error('Create rule error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete Rule
app.delete('/api/rules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM automation_rules WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete rule error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

const aiService = require('./services/aiService');
aiService.initialize(pool); // Initialize with DB pool

// --- AI Execution API ---
app.post('/api/tasks/:id/execute', async (req, res) => {
    const { id } = req.params;
    const { userId, title, description } = req.body;

    // SSE Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // 1. Fetch Task (for ID existence check only)
        const [tasks] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
        if (tasks.length === 0) {
            res.write(`data: ${JSON.stringify({ error: 'Task not found' })}\n\n`);
            res.end();
            return;
        }
        // const task = tasks[0]; // No longer source of truth for AI input

        // 2. Stream Execution (Stateless Input)
        const aiTitle = title || tasks[0].title;
        const aiDesc = description || tasks[0].description || "";

        console.log(`[AI-INPUT-CHECK] Title: ${aiTitle}, Desc: ${aiDesc.substring(0, 50)}...`);

        const stream = aiService.executeTaskStream({
            title: aiTitle,
            description: aiDesc
        });

        let finalResult = '';

        for await (const chunk of stream) {
            if (chunk.type === 'done') {
                finalResult = chunk.fullContent;
            } else {
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
        }

        // 3. Save Result as Comment (Once complete)
        // Only save if we have result
        if (finalResult && finalResult.trim() !== '') {
            const taskIdInt = parseInt(id, 10);
            const targetUserId = userId || 1; // Default to System/Admin ID 1

            console.log(`[AI-DEBUG] Attempting INSERT. TaskID: ${taskIdInt} (Type: ${typeof taskIdInt}), UserID: ${targetUserId}, ContentLen: ${finalResult.length}`);

            try {
                const [result] = await pool.execute(
                    'INSERT INTO task_comments (task_id, user_id, content, type) VALUES (?, ?, ?, ?)',
                    [taskIdInt, targetUserId, finalResult, 'ai_result']
                );
                console.log(`[AI-DEBUG] INSERT Success. InsertID: ${result.insertId}`);

                const [newComment] = await pool.execute(`
                    SELECT c.*, u.name as user_name, u.avatar 
                    FROM task_comments c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.id = ?
                `, [result.insertId]);

                // Broadcast 'commentAdded' to update other clients immediately
                const [proj] = await pool.execute('SELECT project_id FROM tasks WHERE id = ?', [id]);
                if (proj.length > 0) {
                    io.to(`project_${proj[0].project_id}`).emit('commentAdded', {
                        taskId: id,
                        comment: newComment[0],
                        projectId: proj[0].project_id
                    });
                }

                // Send final 'done' event to client so they know to refresh or stop loading
                res.write(`data: ${JSON.stringify({ type: 'complete', result: finalResult })}\n\n`);

            } catch (dbError) {
                console.error('[AI] DB Insert Failed:', dbError);
                res.write(`data: ${JSON.stringify({ error: 'DB Insert Failed: ' + dbError.message })}\n\n`);
            }
        } else {
            console.warn('[AI] Final result is empty, skipping save.');
            res.write(`data: ${JSON.stringify({ error: 'AI output was empty' })}\n\n`);
        }

        res.end();

    } catch (error) {
        console.error('AI Execution Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'AI Execution Failed' })}\n\n`);
        res.end();
    }
});

// --- AI Chat Endpoint ---
app.post('/api/ai/chat', async (req, res) => {
    const { messages, taskContext, projectContext } = req.body;

    // SSE Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamContext = { aborted: false };

    res.on('close', () => {
        console.log('[AI Chat] Connection closed. Aborting generation.');
        streamContext.aborted = true;
    });

    try {
        const stream = aiService.chatStream({ messages, taskContext, projectContext, streamContext });

        for await (const chunk of stream) {
            if (streamContext.aborted) break;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.end();
    } catch (error) {
        if (!streamContext.aborted) {
            console.error('AI Chat Error:', error);
            res.write(`data: ${JSON.stringify({ error: 'Chat Error' })}\n\n`);
            res.end();
        }
    }
});

// --- AI Chat History API ---
app.get('/api/tasks/:id/ai-chat', async (req, res) => {
    const taskId = req.params.id;
    try {
        const history = await aiService.getChatHistory(taskId);
        res.json({ success: true, history });
    } catch (error) {
        console.error('Fetch AI Chat Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
    }
});

// --- Hierarchy Management APIs (Teams & Roles) ---
// Note: Only Admins can manage these via requireHierarchyAdmin

app.get('/api/admin/roles', requireManagerOrAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, description FROM roles');
        res.json({ success: true, roles: rows });
    } catch (error) {
        console.error('Fetch roles error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch roles' });
    }
});

app.post('/api/admin/roles', requireManagerOrAdmin, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Role name is required' });
    try {
        const [result] = await pool.execute('INSERT INTO roles (name, description) VALUES (?, ?)', [name, description || null]);
        res.json({ success: true, role: { id: result.insertId, name, description } });
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ success: false, message: 'Failed to create role' });
    }
});

app.put('/api/admin/roles/:id', requireManagerOrAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await pool.execute('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description, id]);
        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ success: false, message: 'Failed to update role' });
    }
});

app.delete('/api/admin/roles/:id', requireManagerOrAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Basic protection against deleting core roles
        if (id <= 3) return res.status(400).json({ success: false, message: 'Cannot delete core system roles' });
        await pool.execute('DELETE FROM roles WHERE id = ?', [id]);
        res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete role' });
    }
});

app.get('/api/admin/teams', requireManagerOrAdmin, async (req, res) => {
    const currentUser = req.userContext;
    try {
        let query = 'SELECT id, name, description FROM teams';
        let params = [];
        if (currentUser.role === 'team_manager') {
            query += ' WHERE id = ?';
            params.push(currentUser.team_id);
        }
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, teams: rows });
    } catch (error) {
        console.error('Fetch teams error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch teams' });
    }
});

app.post('/api/admin/teams', requireHierarchyAdmin, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required' });
    try {
        const [result] = await pool.execute('INSERT INTO teams (name, description) VALUES (?, ?)', [name, description || null]);
        res.json({ success: true, team: { id: result.insertId, name, description } });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ success: false, message: 'Failed to create team' });
    }
});

app.put('/api/admin/teams/:id', requireHierarchyAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        await pool.execute('UPDATE teams SET name = ?, description = ? WHERE id = ?', [name, description, id]);
        res.json({ success: true, message: 'Team updated successfully' });
    } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({ success: false, message: 'Failed to update team' });
    }
});

app.delete('/api/admin/teams/:id', requireHierarchyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        if (id == 1) return res.status(400).json({ success: false, message: 'Cannot delete default team' });
        await pool.execute('DELETE FROM teams WHERE id = ?', [id]);
        res.json({ success: true, message: 'Team deleted' });
    } catch (error) {
        console.error('Delete team error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete team (Ensure no users are in this team)' });
    }
});

// --- Debug Logs API ---
app.get('/api/debug/logs', (req, res) => {
    res.json({ success: true, logs: serverLogs });
});

// Using PORT defined at line 47
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io running on port ${PORT}`);
});
