const axios = require('axios');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('./config');

async function runTest() {
    let pool;
    try {
        pool = mysql.createPool(config.db);
        console.log('1. Setting up test data...');

        // Ensure Admin exists for API calls
        const [adminRows] = await pool.execute('SELECT id FROM users WHERE role = "admin" LIMIT 1');
        if (adminRows.length === 0) throw new Error("No admin found to setup test");
        const adminId = adminRows[0].id;
        const adminHeaders = { 'x-user-id': adminId };

        // Create Team B
        const teamRes = await axios.post('http://localhost:3000/api/admin/teams',
            { name: 'Red Team', description: 'Test Team B' },
            { headers: adminHeaders }
        );
        const teamB_id = teamRes.data.team.id;
        console.log(`Created Red Team (ID: ${teamB_id})`);

        // Create Team Manager in Red Team
        const tmRes = await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Manager Bob',
            email: `manager_${Date.now()}@test.com`,
            password: 'password123',
            role: 'team_manager',
            team_id: teamB_id
        }, { headers: adminHeaders });

        // Find Manager Bob ID
        const [tmRows] = await pool.execute('SELECT id, team_id FROM users WHERE name = "Manager Bob" ORDER BY id DESC LIMIT 1');
        const tmId = tmRows[0].id;
        console.log(`Created Team Manager (ID: ${tmId}) in Team ${teamB_id}`);

        // Create Member in Red Team
        const mbRes = await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Member Charlie',
            email: `charlie_${Date.now()}@test.com`,
            password: 'password123',
            role: 'member',
            team_id: teamB_id
        }, { headers: adminHeaders });
        const [mbRows] = await pool.execute('SELECT id FROM users WHERE name = "Member Charlie" ORDER BY id DESC LIMIT 1');
        const memberB_id = mbRows[0].id;
        console.log(`Created Member Charlie (ID: ${memberB_id}) in Team ${teamB_id}`);

        // Create Member in Default Team (ID 1)
        const maRes = await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Member Alice',
            email: `alice_${Date.now()}@test.com`,
            password: 'password123',
            role: 'member',
            team_id: 1
        }, { headers: adminHeaders });
        const [maRows] = await pool.execute('SELECT id FROM users WHERE name = "Member Alice" ORDER BY id DESC LIMIT 1');
        const memberA_id = maRows[0].id;
        console.log(`Created Member Alice (ID: ${memberA_id}) in Team 1`);

        console.log('\n2. Testing Team Manager Fetch Scoping...');
        const tmHeaders = { 'x-user-id': tmId };
        const usersRes = await axios.get('http://localhost:3000/api/users', { headers: tmHeaders });
        const fetchedUsers = usersRes.data.users;

        const hasAlice = fetchedUsers.some(u => u.name === 'Member Alice');
        const hasCharlie = fetchedUsers.some(u => u.name === 'Member Charlie');

        if (hasAlice) console.error('❌ FAILED: Manager fetched Alice outside their team.');
        else console.log('✅ Manager successfully blocked from fetching Alice.');

        if (hasCharlie) console.log('✅ Manager successfully fetched Charlie in their team.');
        else console.error('❌ FAILED: Manager could not fetch Charlie.');

        console.log('\n3. Testing Team Manager Mutation Scoping...');

        // Manager tries to edit Alice (Team 1) -> Should 403
        try {
            await axios.put(`http://localhost:3000/api/users/${memberA_id}`, {
                name: 'Alice Hacked',
                email: 'alice@test.com',
                role: 'member'
            }, { headers: tmHeaders });
            console.error('❌ FAILED: Manager successfully edited Alice (outside team).');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('✅ Manager successfully forbidden from editing Alice (403).');
            } else {
                console.error('❌ FAILED: Unexpected error editing Alice:', err.message);
            }
        }

        // Manager tries to edit Charlie (Team B) -> Should 200
        try {
            const editRes = await axios.put(`http://localhost:3000/api/users/${memberB_id}`, {
                name: 'Charlie Updated',
                email: `charlie_${Date.now()}@test.com`,
                role: 'member'
            }, { headers: tmHeaders });
            if (editRes.data.success) {
                console.log('✅ Manager successfully edited Charlie (inside team).');
            }
        } catch (err) {
            console.error('❌ FAILED: Manager could not edit Charlie:', err.message);
        }

        console.log('\nTest suite execution finished.');
    } catch (e) {
        console.error('Error in test:', e.response?.data || e.message);
    } finally {
        if (pool) await pool.end();
    }
}

runTest();
