import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const check = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log("Checking Wallets...");
        const res = await client.query(`SELECT id, name FROM wallets WHERE name ILIKE '%sami virt-0032%' OR name ILIKE '%main%'`);
        console.table(res.rows);

        console.log("Checking IDs in CSV:");
        const ids = ['475ebdf9-5c4d-43a3-b20d-4e1491da0247', 'cea05e1d-6207-4611-8676-13454b2eb749'];
        for (const id of ids) {
            const r = await client.query(`SELECT id, name FROM wallets WHERE id = $1`, [id]);
            if (r.rows.length > 0) console.log(`${id} -> ${r.rows[0].name}`);
            else console.log(`${id} -> NOT FOUND`);
        }

    } catch (e) { console.error(e); }
    finally { client.release(); await pool.end(); }
};
check();
