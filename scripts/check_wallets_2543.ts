import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const check = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        const idToCheck = 'cea05e1d-6207-4611-8676-13454b2eb751';
        console.log(`Checking Wallet ID: ${idToCheck}`);
        const res = await client.query(`SELECT id, name, balance FROM wallets WHERE id = $1`, [idToCheck]);
        console.table(res.rows);

        // Also check if wallet 'noura phy-2543' exists to compare
        const res2 = await client.query(`SELECT id, name FROM wallets WHERE name ILIKE '%2543%'`);
        console.log("Searching by name '%2543%':");
        console.table(res2.rows);

    } catch (e) { console.error(e); }
    finally { client.release(); await pool.end(); }
};
check();
