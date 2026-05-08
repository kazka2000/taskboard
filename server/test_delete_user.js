const axios = require('axios');
const mysql = require('mysql2/promise');
const config = require('./config');

async function runTest() {
    let pool;
    try {
        pool = mysql.createPool(config.db);
        console.log('1. Setting up Test Data...');

        // Fetch Admin
        const [adminRows] = await pool.execute('SELECT id FROM users WHERE role = "admin" LIMIT 1');
        if (adminRows.length === 0) throw new Error("No admin found to setup test");
        const adminId = adminRows[0].id;
        const adminHeaders = { 'x-user-id': adminId };

        // Create Team C and Team D
        const teamCRes = await axios.post('http://localhost:3000/api/admin/teams', { name: 'Delete Team C', description: 'Test Team C' }, { headers: adminHeaders });
        const teamCId = teamCRes.data.team.id;
        const teamDRes = await axios.post('http://localhost:3000/api/admin/teams', { name: 'Delete Team D', description: 'Test Team D' }, { headers: adminHeaders });
        const teamDId = teamDRes.data.team.id;

        // Create Manager for Team C
        const tmCRes = await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Manager Del C',
            email: `manager_del_c_${Date.now()}@test.com`,
            password: 'password123',
            role: 'team_manager',
            team_id: teamCId
        }, { headers: adminHeaders });
        const [tmCRows] = await pool.execute('SELECT id FROM users WHERE name = "Manager Del C" ORDER BY id DESC LIMIT 1');
        const tmCId = tmCRows[0].id;

        // Create Members in Team C and Team D
        await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Member Del C', email: `del_c_${Date.now()}@test.com`, password: '123', role: 'member', team_id: teamCId
        }, { headers: adminHeaders });
        const [mCRows] = await pool.execute('SELECT id FROM users WHERE name = "Member Del C" ORDER BY id DESC LIMIT 1');
        const mCId = mCRows[0].id;

        await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: 'Member Del D', email: `del_d_${Date.now()}@test.com`, password: '123', role: 'member', team_id: teamDId
        }, { headers: adminHeaders });
        const [mDRows] = await pool.execute('SELECT id FROM users WHERE name = "Member Del D" ORDER BY id DESC LIMIT 1');
        const mDId = mDRows[0].id;

        console.log(`Created Team C (${teamCId}), Team D (${teamDId})`);
        console.log(`Manager C: ${tmCId}`);
        console.log(`Member C: ${mCId} (Target Inside Team)`);
        console.log(`Member D: ${mDId} (Target Outside Team)`);

        console.log('\n2. Testing Team Manager Delete Scoping...');
        const tmCHeaders = { 'x-user-id': tmCId };

        // Manager C deletes Member D (Outside Team) -> Should fail with 403
        try {
            await axios.delete(`http://localhost:3000/api/users/${mDId}`, { headers: tmCHeaders });
            console.error('❌ FAILED: Manager successfully deleted user outside their team.');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('✅ PASS: Manager received 403 when deleting outside user.');
            } else {
                console.error('❌ FAILED: Unexpected error deleting outside user:', err.message);
            }
        }

        // Manager C deletes Member C (Inside Team) -> Should succeed 200
        try {
            const delRes = await axios.delete(`http://localhost:3000/api/users/${mCId}`, { headers: tmCHeaders });
            if (delRes.data.success) {
                console.log('✅ PASS: Manager successfully deleted user inside their team.');
            }
        } catch (err) {
            console.error('❌ FAILED: Manager could not delete inside user:', err.message);
        }

        console.log('\nTest suite execution finished.');

    } catch (e) {
        console.error('Error in test:', e.response?.data || e.message);
    } finally {
        if (pool) await pool.end();
    }
}

runTest();
