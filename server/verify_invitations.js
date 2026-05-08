const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const axios = require('axios');
const FormData = require('form-data');

async function verifyBulkAxios() {
    const connection = await mysql.createConnection({
        host: 'localhost', user: 'root', password: '', database: 'taskboard'
    });

    console.log("--- Starting Bulk CSV Verification ---");

    try {
        const [users] = await connection.query("SELECT * FROM users");
        const admin = users.find(u => u.role === 'admin');

        // Clean up from previous tests just in case
        await connection.query("DELETE FROM invitations WHERE email LIKE 'valid%@example.com'");
        await connection.query("DELETE FROM invitations WHERE email LIKE 'invalid%'");

        const csvContent = `email,role\nvalid_bulk1@example.com,member\ninvalid_email_nohost,admin\nvalid_bulk2@example.com,admin\n`;
        const csvPath = path.join(__dirname, 'test_bulk_temp.csv');
        fs.writeFileSync(csvPath, csvContent);

        console.log("\n[TEST 4] Testing Bulk CSV Upload with valid & invalid entries");

        const form = new FormData();
        form.append('file', fs.createReadStream(csvPath));

        const res = await axios.post('http://localhost:3000/api/admin/invite/bulk', form, {
            headers: { 'x-user-id': admin.id, ...form.getHeaders() }
        });

        console.log("✅ Success: Bulk processing API returned success.");
        console.log("   Results:", res.data.results);

        if (res.data.results.successful === 2 && res.data.results.failed === 1) {
            console.log("✅ Validation Logic Verified: Server correctly parsed 2 valid emails and rejected 1 invalid format.");
        } else {
            console.log("❌ Failed: Correct validation counts were not met.");
        }

        fs.unlinkSync(csvPath);
    } catch (e) {
        console.log("❌ Server request failed:", e.response?.data || e.message);
    } finally {
        await connection.end();
        console.log("\n--- Verification Completed ---");
    }
}
verifyBulkAxios();
