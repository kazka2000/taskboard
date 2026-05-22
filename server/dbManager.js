const config = require('./config');
const mysql = require('mysql2/promise');

let pg;
try {
    pg = require('pg');
} catch (e) {
    // pg not installed or available
}

class DbManager {
    constructor() {
        this.type = config.db.type.toLowerCase();
        this.pool = null;
    }

    async init() {
        if (this.pool) return;

        if (this.type === 'mysql') {
            this.pool = mysql.createPool({
                host: config.db.host,
                port: config.db.port,
                user: config.db.user,
                password: config.db.password,
                database: config.db.database,
                timezone: '+09:00',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            console.log(`[DBManager] Initialized MySQL connection pool on ${config.db.host}:${config.db.port}`);
        } else if (this.type === 'postgres' || this.type === 'postgresql') {
            if (!pg) throw new Error("pg module is not installed. Run 'npm install pg'");
            
            this.pool = new pg.Pool({
                host: config.db.host,
                port: config.db.port || 5432,
                user: config.db.user,
                password: config.db.password,
                database: config.db.database,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            console.log(`[DBManager] Initialized PostgreSQL connection pool on ${config.db.host}:${config.db.port}`);
        } else {
            throw new Error(`Unsupported DB_TYPE: ${this.type}`);
        }
    }

    /**
     * Translates MySQL '?' placeholders to PostgreSQL '$1, $2'
     * Also heuristically appends 'RETURNING id' for INSERT statements to simulate mysql's insertId.
     */
    _translateQueryForPg(sql) {
        let count = 1;
        let translated = sql.replace(/\?/g, () => `$${count++}`);
        
        // Very basic simulation of insertId for postgres if it's an INSERT query without returning clause
        if (/^\s*INSERT\s+INTO/i.test(translated) && !/\s+RETURNING\s+/i.test(translated)) {
            translated += ' RETURNING id';
        }

        return translated;
    }

    /**
     * Unified interface to execute queries.
     * Keeps compatibility with mysql2's `[rows, fields]` destructuring syntax.
     * Also polyfills `result.insertId` and `result.affectedRows` for Postgres.
     */
    async execute(sql, params = []) {
        if (!this.pool) {
            await this.init();
        }

        if (this.type === 'mysql') {
            return this.pool.execute(sql, params);
        } else if (this.type === 'postgres' || this.type === 'postgresql') {
            const translatedSql = this._translateQueryForPg(sql);
            const result = await this.pool.query(translatedSql, params);
            
            // Format postgres result to match mysql2 response structure
            let simulatedResultObject = result.rows;
            
            // If it was an INSERT/UPDATE/DELETE, mysql2 returns an info object as the first array element instead of rows
            if (/^\s*(INSERT|UPDATE|DELETE)/i.test(translatedSql)) {
                simulatedResultObject = {
                    affectedRows: result.rowCount,
                    insertId: (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : 0
                };
            }

            return [simulatedResultObject, result.fields];
        }
    }

    async query(sql, params = []) {
        return this.execute(sql, params);
    }

    /**
     * Unified interface to get a single connection/client from the pool.
     * Essential for transactions and multiple dependent operations in a single session.
     * Returns an object wrapped to behave like a mysql2 connection.
     */
    async getConnection() {
        if (!this.pool) {
            await this.init();
        }

        if (this.type === 'mysql') {
            return this.pool.getConnection();
        } else if (this.type === 'postgres' || this.type === 'postgresql') {
            const client = await this.pool.connect();
            const self = this;
            return {
                client,
                async beginTransaction() {
                    await this.client.query('BEGIN');
                },
                async commit() {
                    await this.client.query('COMMIT');
                },
                async rollback() {
                    await this.client.query('ROLLBACK');
                },
                async execute(sql, params = []) {
                    const translatedSql = self._translateQueryForPg(sql);
                    const result = await this.client.query(translatedSql, params);
                    
                    let simulatedResultObject = result.rows;
                    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(translatedSql)) {
                        simulatedResultObject = {
                            affectedRows: result.rowCount,
                            insertId: (result.rows && result.rows.length > 0 && result.rows[0].id) ? result.rows[0].id : 0
                        };
                    }
                    return [simulatedResultObject, result.fields];
                },
                async query(sql, params = []) {
                    return this.execute(sql, params);
                },
                release() {
                    this.client.release();
                }
            };
        } else {
            throw new Error(`Unsupported DB_TYPE: ${this.type}`);
        }
    }
}

// Export a singleton instance
module.exports = new DbManager();
