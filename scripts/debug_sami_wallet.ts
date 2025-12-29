import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const debugSami = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        // 1. Find Wallet
        const walletRes = await client.query(`SELECT * FROM wallets WHERE name ILIKE '%sami phy-9319%'`);
        if (walletRes.rows.length === 0) {
            console.log("Wallet not found!");
            return;
        }
        const wallet = walletRes.rows[0];
        console.log(`Wallet Found: ${wallet.name} (ID: ${wallet.id})`);
        console.log(`Stored Balance: ${wallet.balance}`);

        // 2. Find Transactions
        const txRes = await client.query(`
            SELECT * FROM transactions 
            WHERE from_wallet_id = $1 OR to_wallet_id = $1
            ORDER BY date DESC
        `, [wallet.id]);

        console.log(`Found ${txRes.rows.length} transactions.`);

        let calculated = 0;
        console.log("--- Transaction History ---");
        for (const t of txRes.rows) {
            const amount = parseFloat(t.amount);
            let impact = 0;
            let type = "";

            if (t.to_wallet_id === wallet.id) {
                impact = amount;
                type = "IN (Deposit/Receive)";
            } else {
                impact = -amount;
                type = "OUT (Spend/Transfer)";
            }

            calculated += impact;
            console.log(`${t.date.toISOString().split('T')[0]} | ${type} | ${amount} | Desc: ${t.description} | ID: ${t.id}`);
        }

        console.log("--- Summary ---");
        console.log(`Stored Balance: ${wallet.balance}`);
        console.log(`Calculated from History: ${calculated}`);
        console.log(`Difference: ${parseFloat(wallet.balance) - calculated}`);

        client.release();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};

debugSami();
