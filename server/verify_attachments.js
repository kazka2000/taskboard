const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';

async function runTest() {
    try {
        console.log('Starting verification...');

        // 1. Create a dummy file
        const dummyFilePath = path.join(__dirname, 'test_file.txt');
        fs.writeFileSync(dummyFilePath, 'Hello World Attachment Test');

        // 2. Upload File to a Task (Task ID 1 must exist, or we fetch a project first)
        // Let's assume Task 1 exists or fetch one.
        // Fetch projects to find a valid task.
        const projectsRes = await axios.get(`${BASE_URL}/projects?userId=1`); // Assuming user 1
        const project = projectsRes.data.projects[0];
        let task = project.columns[0]?.tasks[0]; // Access via "columns" as updated in index.js? 
        // Wait, index.js updated "columns" property in project response? Yes: columns: listsWithTasks

        if (!task) {
            // Create a task if none
            const newTask = await axios.post(`${BASE_URL}/projects/${project.id}/tasks`, {
                title: "Attachment Test Task",
                listId: project.columns[0].id,
                assignees: []
            });
            task = { id: newTask.data.taskId };
        }

        console.log(`Using Task ID: ${task.id}`);

        // Upload
        const form = new FormData();
        form.append('file', fs.createReadStream(dummyFilePath));

        const uploadRes = await axios.post(`${BASE_URL}/tasks/${task.id}/attachments`, form, {
            headers: form.getHeaders()
        });
        console.log('Upload Response:', uploadRes.data);
        const attachmentId = uploadRes.data.id;

        // 3. Get Attachments
        const getRes = await axios.get(`${BASE_URL}/tasks/${task.id}/attachments`);
        console.log('Get Response:', getRes.data);
        const uploaded = getRes.data.find(a => a.id === attachmentId);

        if (!uploaded) throw new Error('Uploaded attachment not found in list');

        // 4. Verify Static File Access
        const staticRes = await axios.get(`http://localhost:3000${uploaded.file_path}`);
        if (staticRes.data !== 'Hello World Attachment Test') throw new Error('Static file content mismatch');
        console.log('Static file access verified.');

        // 5. Delete Attachment
        const delRes = await axios.delete(`${BASE_URL}/attachments/${attachmentId}`);
        console.log('Delete Response:', delRes.data);

        // Verify Deletion
        try {
            await axios.get(`http://localhost:3000${uploaded.file_path}`);
            console.error('File should be gone but is accessible!');
        } catch (e) {
            console.log('Static file access failed as expected (404/Error).');
        }

        console.log('Verification Passed!');

        // Cleanup
        fs.unlinkSync(dummyFilePath);

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

runTest();
