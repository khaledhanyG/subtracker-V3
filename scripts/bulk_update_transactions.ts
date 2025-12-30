
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const CSV_PATH = path.join(__dirname, '../bulkUpdate/transactions.csv');

const { Pool } = pg;

const bulkUpdateTransactions = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log(`Reading CSV from ${CSV_PATH}...`);

        if (!fs.existsSync(CSV_PATH)) {
            console.error("File not found!");
            return;
        }

        const content = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        // Headers: id,user_id,date,amount,type,from_wallet_id,to_wallet_id,subscription_id,description,vat_amount,created_at
        console.log(`Found ${lines.length - 1} records.`);

        let processed = 0;
        let errors = 0;

        await client.query('BEGIN');

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 5) continue;

            const [
                idStr, userId, dateStr, amountStr, type,
                fromWalletId, toWalletId, subIdStr, desc, vatStr, createdAt
            ] = row;

            // Fix Date Format: YY-MM-DD HH:mm:ss -> YYYY-MM-DD HH:mm:ss
            let validDate = dateStr;

            // Check if matches DD-MM-YY (e.g., 31-01-25) BUT NOT YYYY-MM-DD
            // If starts with 4 digits, assume standard YYYY-MM-DD and leave alone.
            if (/^\d{4}-/.test(dateStr)) {
                validDate = dateStr;
            }
            else {
                const yyMmDd = /^(\d{2})-(\d{2})-(\d{2})\s/;
                const match = dateStr.match(yyMmDd);
                if (match) {
                    // INPUT is DD-MM-YY (e.g. 31-01-25)
                    // match[1] = DD, match[2] = MM, match[3] = YY
                    // OUTPUT should be YYYY-MM-DD
                    validDate = `20${match[3]}-${match[2]}-${match[1]} ${dateStr.split(' ')[1] || '00:00:00'}`;
                }
            }

            const id = parseInt(idStr);
            const amount = parseFloat(amountStr) || 0;
            const subId = subIdStr ? parseInt(subIdStr) : null;
            const vat = vatStr ? parseFloat(vatStr) : 0;

            // Clean UUIDs (handle empty strings)
            const validFrom = (fromWalletId && fromWalletId.length > 10) ? fromWalletId : null;
            const validTo = (toWalletId && toWalletId.length > 10) ? toWalletId : null;
            const validUserId = (userId && userId.length > 10) ? userId : null;

            if (isNaN(id)) {
                console.log(`Skipping invalid ID row ${i}`);
                continue;
            }

            try {
                // UPSERT Query
                // We use ON CONFLICT (id) DO UPDATE
                await client.query(
                    `INSERT INTO transactions (
                        id, user_id, date, amount, type, 
                        from_wallet_id, to_wallet_id, subscription_id, 
                        description, vat_amount
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        date = EXCLUDED.date,
                        amount = EXCLUDED.amount,
                        type = EXCLUDED.type,
                        from_wallet_id = EXCLUDED.from_wallet_id,
                        to_wallet_id = EXCLUDED.to_wallet_id,
                        subscription_id = EXCLUDED.subscription_id,
                        description = EXCLUDED.description,
                        vat_amount = EXCLUDED.vat_amount;`,
                    [
                        id, validUserId, validDate, amount, type,
                        validFrom, validTo, subId, desc, vat
                    ]
                );
                processed++;
            } catch (err: any) {
                console.error(`Failed to process row ${i} (ID: ${id}):`, err.message);
                errors++;
            }
        }

        // Sync Sequence
        // Since we manually inserted IDs, we must ensure the sequence is ahead of the max ID
        await client.query(`SELECT setval('transaction_id_seq', (SELECT MAX(id) FROM transactions))`);
        console.log("Synced transaction_id_seq.");

        await client.query('COMMIT');
        console.log(`Bulk Update Complete. Processed: ${processed}, Errors: ${errors}`);

    } catch (e) {
        console.error("Script Failed:", e);
        try { await pool.query('ROLLBACK'); } catch { }
    } finally {
        await pool.end();
    }
};

bulkUpdateTransactions();
