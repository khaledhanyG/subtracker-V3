import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const migrateToNumeric = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log("Starting Numeric ID Migration...");
        await client.query('BEGIN');

        // 1. Drop old default (T-Series generator)
        console.log("Dropping old default & sequence...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id DROP DEFAULT`);
        await client.query(`DROP SEQUENCE IF EXISTS transaction_id_seq CASCADE`);

        // 2. Fetch all transactions ordered by Date
        console.log("Fetching transactions...");
        const res = await client.query(`SELECT id, date FROM transactions ORDER BY date ASC, created_at ASC`);
        const txs = res.rows;

        console.log(`Found ${txs.length} transactions to re-sequence.`);

        // 3. Update IDs to '1', '2', '3' (strings first)
        // We do this so the TYPE conversion later succeeds
        for (let i = 0; i < txs.length; i++) {
            const newId = (i + 1).toString(); // '1', '2'...
            const oldId = txs[i].id;

            // To avoid collision if '1' already exists as a T-1 (unlikely to be '1' exactly, but T-1 != 1)
            // But if we have overlapping, update might fail on PK constraint if we are not careful.
            // Since T-XXX vs "1" are disjoint, it should be fine.

            await client.query(`UPDATE transactions SET id = $1 WHERE id = $2`, [newId, oldId]);
        }
        console.log("Renamed all IDs to numeric strings.");

        // 4. Change Column Type to INTEGER
        console.log("Converting column type to INTEGER...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id TYPE INTEGER USING id::integer`);

        // 5. Create New Sequence
        const nextSeq = txs.length + 1;
        console.log(`Setting sequence start to ${nextSeq}...`);

        await client.query(`CREATE SEQUENCE transaction_id_seq START WITH ${nextSeq}`);

        // 6. Set New Default
        console.log("Setting new default value...");
        await client.query(`ALTER TABLE transactions ALTER COLUMN id SET DEFAULT nextval('transaction_id_seq')`);

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

migrateToNumeric();
