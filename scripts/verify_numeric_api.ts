import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const verifyParams = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log("Verifying ID handling...");

        // 1. Insert directly (simulating API logic)
        // We use a raw query here to ensure the DEFAULT works
        const insertRes = await client.query(`
            INSERT INTO transactions (
                user_id, amount, type, description, date,
                from_wallet_id, to_wallet_id
            ) VALUES (
                '5e189da8-2f10-43a6-bb19-be0b05f098ba', 
                100, 
                'INTERNAL_TRANSFER', 
                'Test Numeric ID', 
                NOW(),
                '475ebdf9-5c4d-43a3-b20d-4e1491da0247', 
                'cea05e1d-6207-4611-8676-13454b2eb748'
            ) RETURNING id
        `);

        const newId = insertRes.rows[0].id;
        console.log(`Inserted Transaction ID: ${newId} (Type: ${typeof newId})`);

        if (typeof newId !== 'number') {
            console.error("FAIL: Retuned ID is not a number!");
        } else {
            console.log("PASS: ID is number.");
        }

        // 2. Select using String (simulating DELETE query param)
        const idStr = newId.toString();
        const selectRes = await client.query('SELECT id FROM transactions WHERE id = $1', [idStr]);
        if (selectRes.rowCount === 1) {
            console.log("PASS: Select by String ID works (Implicit Cast)");
        } else {
            console.error("FAIL: Select by String ID failed");
        }

        // 3. Clean up
        await client.query('DELETE FROM transactions WHERE id = $1', [newId]);
        console.log("Cleaned up.");

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
};

verifyParams();
