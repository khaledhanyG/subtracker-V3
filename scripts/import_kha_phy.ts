import fs from 'fs';
import path from 'path';
import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const importKhaPhy = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected to Neon DB");

        const csvPath = path.resolve('bulkUpdate/trans-kha-phy.csv');
        console.log(`Reading CSV from ${csvPath}`);

        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.split('\n');

        // Skip header
        const startIndex = 1;

        let successCount = 0;
        let failCount = 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',');
            // id,user_id,date,amount,type,from_wallet_id,to_wallet_id,subscription_id,description,vat_amount,created_at

            const [
                id, user_id, date, amount, type,
                from_wallet_id, to_wallet_id, subscription_id,
                description, vat_amount, created_at
            ] = cols;

            const safeVal = (v: string) => (v === '' || v === undefined) ? null : v;

            try {
                await client.query(`
                    INSERT INTO transactions (
                        id, user_id, date, amount, type, 
                        from_wallet_id, to_wallet_id, subscription_id, 
                        description, vat_amount, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        date = EXCLUDED.date,
                        amount = EXCLUDED.amount,
                        type = EXCLUDED.type,
                        from_wallet_id = EXCLUDED.from_wallet_id,
                        to_wallet_id = EXCLUDED.to_wallet_id,
                        subscription_id = EXCLUDED.subscription_id,
                        description = EXCLUDED.description,
                        vat_amount = EXCLUDED.vat_amount,
                        created_at = EXCLUDED.created_at
                `, [
                    safeVal(id), safeVal(user_id), safeVal(date), safeVal(amount), safeVal(type),
                    safeVal(from_wallet_id), safeVal(to_wallet_id), safeVal(subscription_id),
                    safeVal(description), safeVal(vat_amount), safeVal(created_at)
                ]);
                successCount++;
            } catch (err) {
                console.error(`Failed to upsert row ${i + 1} (${id}):`, err);
                failCount++;
            }
        }

        console.log(`Kha Phy Import finished. Success: ${successCount}, Failed: ${failCount}`);
        client.release();
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await pool.end();
    }
};

importKhaPhy();
