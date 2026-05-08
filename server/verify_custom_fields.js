const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const ADMIN_ID = 1;

async function verifyCustomFields() {
    try {
        console.log('--- Verifying Custom Fields ---');

        // 1. Get a project
        const resProjects = await axios.get(`${API_URL}/projects?userId=${ADMIN_ID}`);
        if (!resProjects.data.success || resProjects.data.projects.length === 0) {
            console.error('No projects found to test.');
            return;
        }
        const project = resProjects.data.projects[0];
        console.log(`Using Project: ${project.id} - ${project.title}`);

        // 2. Create a Custom Field Definition
        console.log('Creating Custom Field Definition...');
        const resDef = await axios.post(`${API_URL}/projects/${project.id}/custom-fields`, {
            name: 'Priority Level',
            type: 'text',
            position: 1
        });
        const fieldId = resDef.data.fieldId;
        console.log(`Created Field ID: ${fieldId}`);

        // 3. Get Definitions
        console.log('Fetching Definitions...');
        const resDefs = await axios.get(`${API_URL}/projects/${project.id}/custom-fields`);
        const fields = resDefs.data.fields;
        console.log('Fields:', fields);
        const myField = fields.find(f => f.id === fieldId);
        if (!myField) throw new Error('Created field not found in list');

        // 4. Ensure Task Exists or Create One
        let task;
        if (project.columns[0].tasks.length > 0) {
            task = project.columns[0].tasks[0];
        } else {
            console.log('No tasks found, creating one...');
            const resTask = await axios.post(`${API_URL}/projects/${project.id}/tasks`, {
                title: 'Test Task for Custom Fields',
                listId: project.columns[0].id,
                assignees: [ADMIN_ID]
            });
            const taskId = resTask.data.taskId;
            console.log(`Created Task ID: ${taskId}`);
            task = { id: taskId };
        }

        if (task) {
            console.log(`Setting value for Task ${task.id}...`);
            await axios.post(`${API_URL}/tasks/${task.id}/custom-fields`, {
                fieldId: fieldId,
                value: 'High'
            });
            console.log('Value set.');

            // 5. Verify Retrieval (Fetch Project again)
            console.log('Refetching Project to verify value...');
            const resRefetch = await axios.get(`${API_URL}/projects?userId=${ADMIN_ID}`);
            const refetchedProject = resRefetch.data.projects.find(p => p.id === project.id);
            if (!refetchedProject.customFields) throw new Error('customFields missing in project response');

            // Find task
            let refetchedTask;
            refetchedProject.columns.forEach(col => {
                const t = col.tasks.find(t => t.id === task.id);
                if (t) refetchedTask = t;
            });

            if (!refetchedTask) throw new Error('Task not found in refetch');
            console.log('Refetched Task Custom Fields:', refetchedTask.customFieldValues);

            const val = refetchedTask.customFieldValues.find(v => v.field_definition_id === fieldId);
            if (val && val.value === 'High') {
                console.log('SUCCESS: Custom Field Value verified.');
            } else {
                console.error('FAILURE: Value mismatch or missing.', val);
            }
        }

        // Cleanup? Maybe keep it for manual check.

    } catch (e) {
        console.error('Verification Error:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    }
}

verifyCustomFields();
