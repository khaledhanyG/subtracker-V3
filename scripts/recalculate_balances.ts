import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const recalculateBalances = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log("Connected to Neon DB");

        // Fetch all wallets
        const walletsRes = await client.query('SELECT * FROM wallets');
        const wallets = walletsRes.rows;
        console.log(`Found ${wallets.length} wallets.`);

        // Fetch all transactions
        const txRes = await client.query('SELECT * FROM transactions');
        const transactions = txRes.rows;
        console.log(`Found ${transactions.length} transactions.`);

        for (const wallet of wallets) {
            let calculatedBalance = 0;
            const walletId = wallet.id;

            for (const tx of transactions) {
                const amount = parseFloat(tx.amount);

                // Add if incoming
                if (tx.to_wallet_id === walletId) {
                    calculatedBalance += amount;
                }

                // Subtract if outgoing
                if (tx.from_wallet_id === walletId) {
                    calculatedBalance -= amount;
                }
            }

            // Round to 2 decimals to avoid float errors
            calculatedBalance = Math.round(calculatedBalance * 100) / 100;

            if (Math.abs(parseFloat(wallet.balance) - calculatedBalance) > 0.009) {
                console.log(`Updating Wallet ${wallet.name} (${walletId}): Old Balance=${wallet.balance}, New Balance=${calculatedBalance}`);
                await client.query('UPDATE wallets SET balance = $1 WHERE id = $2', [calculatedBalance, walletId]);
            } else {
                console.log(`Wallet ${wallet.name} is correct (${calculatedBalance}).`);
            }
        }

        console.log("Recalculation complete.");
        client.release();
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await pool.end();
    }
};

recalculateBalances();
