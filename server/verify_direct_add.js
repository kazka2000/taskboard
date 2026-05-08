const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const axios = require('axios');
const FormData = require('form-data');

async function verifyAdd() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '', database: 'taskboard'
    });

    console.log("--- Starting Direct Add & Duplicate Verification ---");

    try {
        const [users] = await connection.query("SELECT * FROM users");
        const admin = users.find(u => u.role === 'admin');

        // Cleanup
        await connection.query("DELETE FROM users WHERE username = 'direct@example.com'");
        await connection.query("DELETE FROM invitations WHERE email = 'direct@example.com'");

        console.log("\n[TEST 1] Testing Direct Add User");

        const resDirect = await axios.post('http://localhost:3000/api/admin/users/direct', {
            name: "Direct User", email: 'direct@example.com', password: 'password123', role: 'member'
        }, { headers: { 'x-user-id': admin.id } });

        if (resDirect.data.success) {
            console.log("✅ Success: Direct Add API returned success.");
        } else {
            console.log("❌ Failed: Direct Add API returned false.");
        }

        console.log("\n[TEST 2] Testing Duplicate Block on Direct Add");
        try {
            await axios.post('http://localhost:3000/api/admin/users/direct', {
                name: "Direct User 2", email: 'direct@example.com', password: 'password123', role: 'member'
            }, { headers: { 'x-user-id': admin.id } });
            console.log("❌ Failed: API allowed adding a duplicate user.");
        } catch (e) {
            if (e.response && e.response.status === 400 && e.response.data.message.includes('active user')) {
                console.log("✅ Validation Logic Verified: Server correctly blocked direct duplicate mapping.");
            } else {
                console.log("❌ Failed with unexpected error:", e.message);
            }
        }

        console.log("\n[TEST 3] Testing Bulk Duplicate Rejection against Active Users");
        const csvContent = `email,role\ndirect@example.com,member\nfresh@example.com,admin\n`;
        const csvPath = path.join(__dirname, 'test_dup_bulk.csv');
        fs.writeFileSync(csvPath, csvContent);

        await connection.query("DELETE FROM invitations WHERE email = 'fresh@example.com'");

        const form = new FormData();
        form.append('file', fs.createReadStream(csvPath));

        const resBulk = await axios.post('http://localhost:3000/api/admin/invite/bulk', form, {
            headers: { 'x-user-id': admin.id, ...form.getHeaders() }
        });

        console.log("   Bulk Results:", resBulk.data.results);
        if (resBulk.data.results.successful === 1 && resBulk.data.results.failed === 1 && resBulk.data.results.errors[0].includes('active user')) {
            console.log("✅ Validation Logic Verified: Bulk correctly blocked the active user (direct@example.com) and allowed the fresh one.");
        } else {
            console.log("❌ Failed: Bulk validation counts incorrect.");
        }

        fs.unlinkSync(csvPath);
    } catch (e) {
        console.log("❌ Server request failed:", e.response?.data || e.message);
    } finally {
        await connection.end();
        console.log("\n--- Verification Completed ---");
    }
}
verifyAdd();
