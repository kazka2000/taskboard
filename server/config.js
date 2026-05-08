const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
    db: {
        type: process.env.DB_TYPE || 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'taskboard',
    }
};
