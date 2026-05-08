const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const USER_ID = 1; // Assuming admin user exists

async function testWorkspaces() {
    try {
        console.log('--- Testing Workspaces ---');

        // 1. Get Workspaces
        console.log('1. Fetching workspaces...');
        const res1 = await axios.get(`${API_URL}/workspaces?userId=${USER_ID}`);
        console.log('Workspaces:', res1.data.workspaces.length);
        const defaultWorkspace = res1.data.workspaces[0];
        console.log('Default Workspace ID:', defaultWorkspace?.id, defaultWorkspace?.name);

        // 2. Create New Workspace
        console.log('\n2. Creating new workspace...');
        const res2 = await axios.post(`${API_URL}/workspaces`, {
            name: 'Test Workspace',
            description: 'Created by verification script',
            ownerId: USER_ID
        });
        const newWorkspaceId = res2.data.workspaceId;
        console.log('Created Workspace ID:', newWorkspaceId);

        // 3. Create Project in New Workspace
        console.log('\n3. Creating project in new workspace...');
        const res3 = await axios.post(`${API_URL}/projects`, {
            title: 'Workspace Project',
            description: 'Project inside test workspace',
            ownerId: USER_ID,
            workspaceId: newWorkspaceId
        });
        const newProjectId = res3.data.projectId;
        console.log('Created Project ID:', newProjectId);

        // 4. Fetch Projects filtered by Workspace
        console.log('\n4. Fetching projects for new workspace...');
        const res4 = await axios.get(`${API_URL}/projects?userId=${USER_ID}&workspaceId=${newWorkspaceId}`);
        const projectsInWorkspace = res4.data.projects;
        console.log('Projects in Workspace:', projectsInWorkspace.length);
        const found = projectsInWorkspace.find(p => p.id === newProjectId);
        console.log('Found created project:', !!found);

        // 5. Cleanup
        console.log('\n5. Cleaning up...');
        await axios.delete(`${API_URL}/projects/${newProjectId}`);
        await axios.delete(`${API_URL}/workspaces/${newWorkspaceId}`);
        console.log('Cleanup done.');

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testWorkspaces();
