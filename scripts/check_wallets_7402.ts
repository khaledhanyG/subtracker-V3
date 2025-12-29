import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const check = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log("Checking Wallets...");
        const res = await client.query(`SELECT id, name FROM wallets WHERE name ILIKE '%sami phy-7402%' OR name ILIKE '%main%'`);
        console.table(res.rows);

        // Check IDs found in CSV (manually extracted from view_file response below if possible, or just exact match check logic)
        // I will wait to see the file content first, but I'll write a generic checker script now that accepts args or I'll just check the known suspected wallet.
    } catch (e) { console.error(e); }
    finally { client.release(); await pool.end(); }
};
check();
