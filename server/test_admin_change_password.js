const axios = require('axios');

async function testPasswordChange() {
    try {
        console.log('1. Fetching all users using admin context...');
        const usersRes = await axios.get('http://localhost:3000/api/users');
        const users = usersRes.data.users;

        if (users.length < 2) {
            console.log('Not enough users to test update. Skipping.');
            return;
        }

        const targetUser = users[1]; // Pick user1
        console.log(`Targeting user ID ${targetUser.id} (${targetUser.username}) for testing.`);

        const newPassword = 'newPassword123!@#';

        console.log(`\n2. Updating user password to "${newPassword}"...`);
        const updatePayload = {
            name: targetUser.name,
            email: targetUser.username,
            role: targetUser.role,
            avatar: targetUser.avatar,
            password: newPassword
        };

        const config = { headers: { 'x-user-id': users[0].id } }; // assuming users[0] is admin

        const updateRes = await axios.put(`http://localhost:3000/api/users/${targetUser.id}`, updatePayload, config);
        console.log('Update Response:', updateRes.data);

        console.log(`\n3. Attempting to log in with new password "${newPassword}"...`);
        const loginPayload = {
            username: targetUser.username,
            password: newPassword
        };
        const loginRes = await axios.post('http://localhost:3000/api/login', loginPayload);

        if (loginRes.data.success) {
            console.log('✅ Update and Login verified successfully!');
        } else {
            console.error('❌ Update failed verification.');
        }

        console.log('\n4. Cleaning up... (keeping the new password for test simplicity, it works!)');

    } catch (error) {
        console.error('Test Error:', error.response?.data || error.message);
    }
}

testPasswordChange();
