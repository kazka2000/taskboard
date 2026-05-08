const dbManager = require('./dbManager');

async function test() {
    console.log('Testing DbManager Initialization...');
    try {
        await dbManager.init();
        console.log('[SUCCESS] DbManager Initialized. Type:', dbManager.type);
        
        console.log('Testing a query (Fetching a user limit 1)...');
        const [rows, fields] = await dbManager.execute('SELECT * FROM users LIMIT 1');
        
        if (rows.length >= 0) {
            console.log('[SUCCESS] Query executed successfully. Rows returned:', rows.length);
        } else {
            console.log('[ERROR] Expected an array of rows.');
        }

        console.log('Testing query translation internally...');
        const sql = 'SELECT * FROM users WHERE id = ? AND status = ?';
        const translated = dbManager._translateQueryForPg(sql);
        console.log('[DEBUG] Original MySQL:', sql);
        console.log('[DEBUG] Translated PG :', translated);
        if (translated.includes('$1') && translated.includes('$2')) {
            console.log('[SUCCESS] Query translated correctly.');
        } else {
            console.log('[ERROR] Query translation failed.');
        }
    } catch (e) {
        console.error('[ERROR]', e);
    } finally {
        process.exit();
    }
}

test();
