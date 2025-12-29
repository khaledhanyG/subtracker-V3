import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const deleteKhaVirt = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected to Neon DB");

        const KHA_VIRT = 'cea05e1d-6207-4611-8676-13454b2eb746';

        // Delete transactions where source or dest is Khaled Virt
        const res = await client.query(`
            DELETE FROM transactions 
            WHERE from_wallet_id = $1 OR to_wallet_id = $1
        `, [KHA_VIRT]);

        console.log(`Deleted ${res.rowCount} transactions for wallet ${KHA_VIRT}`);

        // Also reset balance to 0 manually? 
        // No, recalculate_balances will rebuild it from remaining transactions (which will be 0 after delete).
        // But deleting these also affects MAIN wallet. Recalculate will fix MAIN wallet too.

        client.release();
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await pool.end();
    }
};

deleteKhaVirt();
