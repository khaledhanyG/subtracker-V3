import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const migrateIds = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log("Starting ID Migration...");
        await client.query('BEGIN');

        // 1. Drop Default (likely gen_random_uuid())
        console.log("Dropping old default...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id DROP DEFAULT`);

        // 2. Change Column Type to TEXT
        console.log("Altering column type to TEXT...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id TYPE TEXT USING id::text`);

        // 3. Fetch all transactions ordered by Date
        console.log("Fetching transactions...");
        const res = await client.query(`SELECT id, date FROM transactions ORDER BY date ASC, created_at ASC`); // fallback to created_at if date same
        const txs = res.rows;

        console.log(`Found ${txs.length} transactions to rename.`);

        // 4. Update IDs sequentially
        for (let i = 0; i < txs.length; i++) {
            const newId = `T-${i + 1}`;
            const oldId = txs[i].id;

            // Optimization: Update in batches or one by one. One by one is safer for avoiding unique violations if any overlap (unlikely).
            // We need to defer constraints? No, checking standard PK.

            await client.query(`UPDATE transactions SET id = $1 WHERE id = $2`, [newId, oldId]);
        }
        console.log("Renaming complete.");

        // 5. Create Sequence
        const nextSeq = txs.length + 1;
        console.log(`Setting sequence start to ${nextSeq}...`);

        await client.query(`DROP SEQUENCE IF EXISTS transaction_id_seq`);
        await client.query(`CREATE SEQUENCE transaction_id_seq START WITH ${nextSeq}`);

        // 6. Set New Default
        console.log("Setting new default value...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id SET DEFAULT 'T-' || nextval('transaction_id_seq')`);

        await client.query('COMMIT');
        console.log("Migration Successfully Committed!");

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Migration Failed & Rolled Back:", e);
    } finally {
        client.release();
        await pool.end();
    }
};

migrateIds();
