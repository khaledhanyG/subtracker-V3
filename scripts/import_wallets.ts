import fs from 'fs';
import path from 'path';
import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const importWallets = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected to Neon DB");

        const csvPath = path.resolve('bulkUpdate/wallets.csv');
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

            // Simple split by comma. Note: If name contains comma, this will break. 
            // Assuming simple CSV structure based on file provided.
            const cols = line.split(',');
            // id,user_id,name,type,balance,status,holder_name,created_at

            const [
                id, user_id, name, type, balance, status, holder_name, created_at
            ] = cols;

            const safeVal = (v: string) => (v === '' || v === undefined) ? null : v;

            try {
                await client.query(`
                    INSERT INTO wallets (
                        id, user_id, name, type, balance, status, holder_name, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        name = EXCLUDED.name,
                        type = EXCLUDED.type,
                        balance = EXCLUDED.balance,
                        status = EXCLUDED.status,
                        holder_name = EXCLUDED.holder_name,
                        created_at = EXCLUDED.created_at
                `, [
                    safeVal(id), safeVal(user_id), safeVal(name), safeVal(type),
                    safeVal(balance), safeVal(status), safeVal(holder_name), safeVal(created_at)
                ]);
                successCount++;
            } catch (err) {
                console.error(`Failed to upsert row ${i + 1} (${id}):`, err);
                failCount++;
            }
        }

        console.log(`Wallets import finished. Success: ${successCount}, Failed: ${failCount}`);
        client.release();
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await pool.end();
    }
};

importWallets();
