const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function test() {
    try {
        // 1. Login as Admin
        console.log('Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            username: 'admin',
            password: 'admin123'
        });
        const adminUser = loginRes.data.user;
        console.log('Logged in as:', adminUser.username);

        // 2. Create Project with Background
        console.log('Creating project...');
        const createRes = await axios.post(`${API_URL}/projects`, {
            title: 'Test Background Project',
            description: 'Testing background feature',
            ownerId: adminUser.id,
            background: { type: 'color', value: '#FF5733' }
        });
        const projectId = createRes.data.projectId;
        console.log('Project created with ID:', projectId);

        // 3. Verify Background in DB (by fetching project list)
        console.log('Verifying initial background...');
        const projectsRes = await axios.get(`${API_URL}/projects`, {
            params: { userId: adminUser.id }
        });
        const project = projectsRes.data.projects.find(p => p.id === projectId);

        if (project.background_type === 'color' && project.background_value === '#FF5733') {
            console.log('SUCCESS: Initial background saved correctly.');
        } else {
            console.error('FAILURE: Initial background incorrect:', project.background_type, project.background_value);
        }

        // 4. Update Background
        console.log('Updating background...');
        await axios.put(`${API_URL}/projects/${projectId}`, {
            userId: adminUser.id,
            background: { type: 'image', value: '/uploads/bg-test.png' }
        });

        // 5. Verify Update
        console.log('Verifying updated background...');
        const projectsRes2 = await axios.get(`${API_URL}/projects`, {
            params: { userId: adminUser.id }
        });
        const projectUpdated = projectsRes2.data.projects.find(p => p.id === projectId);

        if (projectUpdated.background_type === 'image' && projectUpdated.background_value === '/uploads/bg-test.png') {
            console.log('SUCCESS: Background updated correctly.');
        } else {
            console.error('FAILURE: Background update incorrect:', projectUpdated.background_type, projectUpdated.background_value);
        }

        // 6. Test Permission (Fail Case)
        // Login as user1
        console.log('Logging in as user1...');
        const loginRes2 = await axios.post(`${API_URL}/login`, {
            username: 'user1',
            password: 'user123'
        });
        const user1 = loginRes2.data.user;

        console.log('Attempting unauthorized update by user1...');
        try {
            await axios.put(`${API_URL}/projects/${projectId}`, {
                userId: user1.id,
                background: { type: 'color', value: '#000000' }
            });
            console.error('FAILURE: Unauthorized update succeeded (should have failed).');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                console.log('SUCCESS: Unauthorized update failed with 403 as expected.');
            } else {
                console.error('FAILURE: Unexpected error during unauthorized update:', error.message);
            }
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

test();
