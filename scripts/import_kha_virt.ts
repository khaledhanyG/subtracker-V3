import fs from 'fs';
import path from 'path';
import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const importKhaVirt = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected to Neon DB");

        const csvPath = path.resolve('bulkUpdate/trans-kha-virt.csv');
        console.log(`Reading CSV from ${csvPath}`);

        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.split('\n');

        // Skip header
        const startIndex = 1;

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;

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

            const parseDate = (d: string) => {
                if (!d) return null;

                // Handle Excel Serial Date (e.g. 45929)
                if (/^\d+$/.test(d)) {
                    const serial = parseInt(d);
                    // Excel base date 1899-12-30 essentially (due to 1900 leap year bug)
                    // JS dates are milliseconds since 1970-01-01
                    // 25569 days offset between 1900-01-01 and 1970-01-01. 
                    // Adjusting slightly to match common Excel usage.
                    const dateObj = new Date((serial - 25569) * 86400 * 1000);
                    return dateObj.toISOString().split('T')[0] + ' 00:00:00';
                }

                // Check if already ISO-ish (has 2025 or similar)
                if (d.includes('2025-') || d.includes('2024-')) return d;

                // Expect DD-MM-YY H:MM like "19-01-25 0:00"
                const [datePart, timePart] = d.split(' ');
                if (!datePart) return null;
                const parts = datePart.split('-');
                if (parts.length !== 3) return d; // Fallback
                const [day, month, year] = parts;

                // Assume 20xx for year if 2 digits
                const fullYear = year.length === 2 ? `20${year}` : year;

                return `${fullYear}-${month}-${day} ${timePart || '00:00:00'}`;
            };

            // User requested all amounts to be positive
            const safeAmount = (a: string) => {
                const v = parseFloat(a);
                if (isNaN(v)) return 0;
                return Math.abs(v);
            };

            const finalDate = parseDate(date);
            const finalAmount = safeAmount(amount);

            try {
                // Deduplication check: Same amount, date, type, source, dest
                // We use explicit NULL checks or simple comparison
                const existing = await client.query(
                    `SELECT id FROM transactions 
                     WHERE amount = $1 AND date = $2 AND type = $3 
                     AND (from_wallet_id = $4 OR ($4 IS NULL AND from_wallet_id IS NULL))
                     AND (to_wallet_id = $5 OR ($5 IS NULL AND to_wallet_id IS NULL))
                     LIMIT 1`,
                    [finalAmount, finalDate, safeVal(type), safeVal(from_wallet_id), safeVal(to_wallet_id)]
                );

                if (existing.rowCount > 0) {
                    // console.log(`Skipping duplicate row ${i + 1}`);
                    skipCount++;
                    continue;
                }

                // We ignore the CSV ID and let the DB generate a new UUID
                await client.query(`
                    INSERT INTO transactions (
                        user_id, date, amount, type, 
                        from_wallet_id, to_wallet_id, subscription_id, 
                        description, vat_amount, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    safeVal(user_id), finalDate, finalAmount, safeVal(type),
                    safeVal(from_wallet_id), safeVal(to_wallet_id), safeVal(subscription_id),
                    safeVal(description), safeVal(vat_amount), safeVal(created_at)
                ]);
                successCount++;
            } catch (err) {
                console.error(`Failed to insert row ${i + 1}:`, err);
                failCount++;
            }
        }

        console.log(`Kha Virt Import finished. Success: ${successCount}, Skips: ${skipCount}, Failed: ${failCount}`);
        client.release();
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await pool.end();
    }
};

importKhaVirt();
