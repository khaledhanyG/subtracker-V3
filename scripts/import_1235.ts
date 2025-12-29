import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const CSV_PATH = path.join(__dirname, '../bulkUpdate/trans-1235.csv');

const { Pool } = pg;

const importTransactions = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        console.log(`Reading CSV from ${CSV_PATH}...`);
        const content = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');

        console.log(`Found ${lines.length - 1} lines (potential transactions).`);

        let imported = 0;
        let skipped = 0;

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            // Basic filtering for empty rows (common in Excel exports)
            if (row.length < 5 || !row[1] || !row[2]) {
                console.log(`Skipping invalid/empty row ${i}`);
                continue;
            }

            const [
                csvId, userId, dateStr, amountStr, type,
                fromWalletId, toWalletId, subId, desc, vatStr, createdAt
            ] = row;

            // 1. Parse Date - CSV Format: DD-MM-YY 0:00
            const parseDate = (d: string) => {
                if (!d) return new Date().toISOString();
                if (d.includes('T')) return d;

                const [datePart, timePart] = d.split(' ');
                const parts = datePart?.split('-') || [];
                if (parts.length !== 3) return new Date().toISOString();

                // Format: DD-MM-YY -> 20YY-MM-DD
                const [day, month, year] = parts;
                const fullYear = year.length === 2 ? `20${year}` : year;
                return `${fullYear}-${month}-${day} ${timePart || '00:00:00'}`;
            };
            const finalDate = parseDate(dateStr);

            // 2. Parse Amount
            const amt = parseFloat(amountStr);
            const finalAmount = isNaN(amt) ? 0 : Math.abs(amt);

            // 3. Deduplication Check
            const existing = await client.query(
                `SELECT id FROM transactions 
                 WHERE amount = $1 AND date = $2 AND type = $3 
                 AND (from_wallet_id = $4 OR ($4 IS NULL AND from_wallet_id IS NULL))
                 AND (to_wallet_id = $5 OR ($5 IS NULL AND to_wallet_id IS NULL))
                 LIMIT 1`,
                [finalAmount, finalDate, type, fromWalletId || null, toWalletId || null]
            );

            if (existing.rows.length > 0) {
                console.log(`Skipping existing tx (Row ${i}): ${desc} - ${finalAmount}`);
                skipped++;
                continue;
            }

            // 4. Insert (IGNORING CSV ID to use SERIAL)
            await client.query(
                `INSERT INTO transactions (
                    user_id, date, amount, type, 
                    from_wallet_id, to_wallet_id, subscription_id, 
                    description, vat_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userId, finalDate, finalAmount, type,
                    fromWalletId || null, toWalletId || null, subId || null,
                    desc || '', vatStr ? parseFloat(vatStr) : 0
                ]
            );
            imported++;
        }

        console.log(`Import Complete. Imported: ${imported}, Skipped: ${skipped}`);
        client.release();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};

importTransactions();
