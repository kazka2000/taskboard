const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const API_URL = 'http://localhost:3000/api';

async function test() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/login`, {
            username: 'admin',
            password: 'admin123'
        });
        const user = loginRes.data.user;
        const projectId = 1; // Assuming project 1 exists from previous tests or logic

        // 2. Prepare File
        const filePath = path.join(__dirname, '..', 'package.json'); // Use package.json as dummy
        if (!fs.existsSync(filePath)) {
            console.error('Dummy file not found');
            return;
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        // 3. Upload
        console.log('Uploading file to project', projectId);
        const uploadRes = await axios.post(`${API_URL}/projects/${projectId}/background`, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('Upload Response:', uploadRes.data);

        if (uploadRes.data.success && uploadRes.data.filePath) {
            console.log('SUCCESS: File uploaded. Path:', uploadRes.data.filePath);

            // Verify access
            const fileUrl = `http://localhost:3000${uploadRes.data.filePath}`;
            console.log('Checking file access at:', fileUrl);
            const getRes = await axios.get(fileUrl);
            if (getRes.status === 200) {
                console.log('SUCCESS: File is accessible.');
            }
        } else {
            console.error('FAILURE: Upload unsuccessful.');
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

test();
