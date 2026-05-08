const axios = require('axios');

async function test() {
  try {
    console.log('--- Test 1: userId=1 (Admin) ---');
    // Basic call
    let res = await axios.get('http://localhost:3000/api/projects?userId=1');
    console.log(`Success: ${res.data.success}, Count: ${res.data.projects.length}`);

    console.log('\n--- Test 2: userId=1 & workspaceId="undefined" ---');
    res = await axios.get('http://localhost:3000/api/projects?userId=1&workspaceId=undefined');
    console.log(`Success: ${res.data.success}, Count: ${res.data.projects.length}`);

    console.log('\n--- Test 3: userId=1 & workspaceId="null" ---');
    res = await axios.get('http://localhost:3000/api/projects?userId=1&workspaceId=null');
    console.log(`Success: ${res.data.success}, Count: ${res.data.projects.length}`);

    console.log('\n--- Test 4: userId=1 & workspaceId="" ---');
    res = await axios.get('http://localhost:3000/api/projects?userId=1&workspaceId=');
    console.log(`Success: ${res.data.success}, Count: ${res.data.projects.length}`);

  } catch (e) {
    console.error('Error:', e.message);
    if (e.response) console.error('Response:', e.response.data);
  }
}

test();
