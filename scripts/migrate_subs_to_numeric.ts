
import pg from 'pg';

// Connection String
const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const migrateSubsToNumeric = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        console.log("Starting Subscription ID Migration to Numeric...");
        await client.query('BEGIN');

        // 1. Fetch all subscriptions ordered by created_at or name
        // We order by created_at to keep older subs with lower IDs
        const res = await client.query(`SELECT id, name FROM subscriptions ORDER BY created_at ASC`);
        const subs = res.rows;
        console.log(`Found ${subs.length} subscriptions.`);

        // 2. Drop Foreign Key Constraint on transactions
        // We need to find the constraint name first or assume a standard one.
        // Usually: transactions_subscription_id_fkey
        // Let's try to drop it safely.
        await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_subscription_id_fkey`);

        // 3. Drop Default on subscriptions.id (uuid_generate_v4)
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id DROP DEFAULT`);

        // 4. Temporary: Change IDs to TEXT to allow holding '1', '2' etc mixed with UUIDs if needed during update?
        // Actually, we can just update them to string representations of numbers first: '1', '2'...
        // But the column is UUID. We must cast it to TEXT first to hold '1'.
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id TYPE VARCHAR(255)`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN subscription_id TYPE VARCHAR(255)`);

        // 5. Update IDs
        for (let i = 0; i < subs.length; i++) {
            const oldId = subs[i].id;
            const newId = (i + 1).toString();

            // Update Subscription
            await client.query(`UPDATE subscriptions SET id = $1 WHERE id = $2`, [newId, oldId]);

            // Update Linked Transactions
            await client.query(`UPDATE transactions SET subscription_id = $1 WHERE subscription_id = $2`, [newId, oldId]);

            console.log(`Migrated Sub: ${subs[i].name} (${oldId} -> ${newId})`);
        }

        // 6. Change Column Type to INTEGER
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id TYPE INTEGER USING id::integer`);
        await client.query(`ALTER TABLE transactions ALTER COLUMN subscription_id TYPE INTEGER USING subscription_id::integer`);

        // 7. Create Sequence and Set Default
        const nextSeq = subs.length + 1;
        await client.query(`DROP SEQUENCE IF EXISTS subscription_id_seq CASCADE`);
        await client.query(`CREATE SEQUENCE subscription_id_seq START WITH ${nextSeq}`);
        await client.query(`ALTER TABLE subscriptions ALTER COLUMN id SET DEFAULT nextval('subscription_id_seq')`);

        // 8. Restore Foreign Key
        await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)`);

        await client.query('COMMIT');
        console.log("Migration Successful!");

    } catch (e) {
        console.error("Migration Failed:", e);
        await client.query('ROLLBACK'); // Safety rollback
        // Note: client might be disconnected if error is severe, but try anyway
    } finally {
        await pool.end();
    }
};

migrateSubsToNumeric();
