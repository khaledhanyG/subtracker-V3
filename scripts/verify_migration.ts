import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const verify = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        // Fetch a valid user_id
        const userRes = await client.query('SELECT user_id FROM transactions LIMIT 1');
        const userId = userRes.rows[0]?.user_id;

        console.log("Adding Test Transaction...");
        // Insert a dummy transaction - DB should auto-generate ID: T-142
        const res = await client.query(`
            INSERT INTO transactions (amount, type, description, date, from_wallet_id, user_id)
            VALUES (1, 'INTERNAL_TRANSFER', 'Verification Test', NOW(), NULL, $1)
            RETURNING id
        `, [userId]);
        const newId = res.rows[0].id;
        console.log(`Generated ID: ${newId}`);

        if (newId.startsWith('T-')) {
            console.log("SUCCESS: ID format is correct.");
        } else {
            console.error("FAILURE: ID format incorrect.");
        }

        // Remove it
        await client.query(`DELETE FROM transactions WHERE id = $1`, [newId]);
        console.log("Cleanup done.");

    } catch (e) { console.error(e); }
    finally { client.release(); await pool.end(); }
};
verify();
