const axios = require('axios');

async function testUserUpdate() {
    try {
        console.log('1. Fetching all users...');
        const usersRes = await axios.get('http://localhost:3000/api/users');
        const users = usersRes.data.users;

        if (users.length < 2) {
            console.log('Not enough users to test update. Skipping.');
            return;
        }

        const targetUser = users[1]; // Pick a user that is not admin (usually index 1 or 2)
        console.log(`Targeting user ID ${targetUser.id} (${targetUser.username}) for testing.`);

        const originalName = targetUser.name;
        const testName = 'Test Edited Name ' + Date.now();
        const testAvatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo';

        console.log(`\n2. Updating user name to "${testName}" and changing avatar seed...`);
        const updatePayload = {
            name: testName,
            email: targetUser.username,
            role: targetUser.role,
            avatar: testAvatarUrl
        };

        // Simulating admin user header since endpoint requires requireAdmin
        const config = { headers: { 'x-user-id': users[0].id } }; // assuming users[0] is the admin

        const updateRes = await axios.put(`http://localhost:3000/api/users/${targetUser.id}`, updatePayload, config);
        console.log('Update Response:', updateRes.data);

        console.log('\n3. Fetching users again to verify update...');
        const checkRes = await axios.get('http://localhost:3000/api/users');
        const updatedUser = checkRes.data.users.find(u => u.id === targetUser.id);

        if (updatedUser.name === testName && updatedUser.avatar === testAvatarUrl) {
            console.log('✅ Update verified successfully in database!');
        } else {
            console.error('❌ Update failed verification verification.');
        }

        console.log('\n4. Reverting user back to original state to preserve data...');
        await axios.put(`http://localhost:3000/api/users/${targetUser.id}`, {
            name: originalName,
            email: targetUser.username,
            role: targetUser.role,
            avatar: targetUser.avatar
        }, config);
        console.log('Reversion Request Sent.');

    } catch (error) {
        console.error('Test Error:', error.response?.data || error.message);
    }
}

testUserUpdate();
