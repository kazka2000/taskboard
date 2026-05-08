const axios = require('axios');

async function testBulkFailure() {
    try {
        console.log('1. Fetching Projects...');
        const projectsRes = await axios.get('http://localhost:3000/api/projects?userId=1');
        if (!projectsRes.data.success || projectsRes.data.projects.length === 0) {
            console.error('No projects found.');
            return;
        }

        const project = projectsRes.data.projects[0];
        console.log(`Using Project: ${project.title} (ID: ${project.id})`);

        const columns = project.columns;
        // Find 'Done' list or just use second column
        const doneList = columns.find(c => ['done', 'completed', '완료'].includes(c.title.toLowerCase()));
        const targetList = doneList || columns[1] || columns[0]; // Prefer Done, then 2nd col, then 1st

        console.log(`Target List: ${targetList.title} (ID: ${targetList.id})`);

        // Find a task (preferably not in target list, but okay if it is)
        let taskId = null;
        for (const col of columns) {
            if (col.tasks && col.tasks.length > 0) {
                taskId = col.tasks[0].id;
                break;
            }
        }

        if (!taskId) {
            // Create a temporary task
            console.log('No tasks found, creating one...');
            const createRes = await axios.post(`http://localhost:3000/api/projects/${project.id}/tasks`, {
                title: 'Temp Bulk Test Task',
                listId: columns[0].id,
                userId: 1
            });
            taskId = createRes.data.taskId;
        }

        console.log(`Using Task ID: ${taskId}`);

        // Perform Bulk Update
        console.log('2. Performing Bulk Update (Move to List)...');
        const payload = {
            taskIds: [taskId],
            updates: {
                listId: targetList.id // USE .id from API response
            },
            userId: 1
        };

        const res = await axios.patch('http://localhost:3000/api/tasks/bulk-update', payload);
        console.log('Response:', res.data);

    } catch (error) {
        if (error.response) {
            console.error('API Error Status:', error.response.status);
            console.error('API Error Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testBulkFailure();
