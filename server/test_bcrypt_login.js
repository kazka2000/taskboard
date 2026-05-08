const axios = require('axios');

async function runTest() {
    try {
        console.log('1. Creating a new test user via Direct Add...');
        const email = `bcrypt_test_${Date.now()}@example.com`;
        const directPayload = {
            adminId: 1, // assuming user id 1 is admin
            name: "Bcrypt Test User",
            email: email,
            password: "testpassword123",
            role: "member"
        };
        const addRes = await axios.post('http://localhost:3000/api/admin/users/direct', directPayload);
        console.log('Direct Add Response:', addRes.data);

        console.log('\n2. Attempting to login with the newly created user...');
        const loginPayload = {
            username: email,
            password: "testpassword123"
        };
        const loginRes = await axios.post('http://localhost:3000/api/login', loginPayload);
        console.log('Login Response Status:', loginRes.status);
        console.log('Login Response Data:', loginRes.data);

        if (loginRes.data.success) {
            console.log('\n✅ Login successful!');
            console.log('User object received perfectly.');
        }

    } catch (error) {
        console.error('\n❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
