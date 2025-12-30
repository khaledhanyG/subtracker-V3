
import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const { Pool } = pg;

const fixDates = async () => {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        console.log("Checking for incorrect dates (Year != 2025, Day = 25)...");
        const checkRes = await client.query(`
            SELECT count(*) as count, min(date) as earliest, max(date) as latest 
            FROM transactions 
            WHERE EXTRACT(DAY FROM date) = 25 AND EXTRACT(YEAR FROM date) != 2025
        `);
        console.log(`Found ${checkRes.rows[0].count} records to fix.`);
        console.log(`Range: ${checkRes.rows[0].earliest} - ${checkRes.rows[0].latest}`);

        if (parseInt(checkRes.rows[0].count) > 0) {
            console.log("Applying fix...");
            // Logic: Swap Year and Day.
            // Current Year (e.g. 2031) -> becomes Day 31
            // Current Day (25) -> becomes Year 2025

            const updateRes = await client.query(`
                UPDATE transactions 
                SET date = make_date(
                    (2000 + EXTRACT(DAY FROM date)::int), 
                    EXTRACT(MONTH FROM date)::int, 
                    (EXTRACT(YEAR FROM date)::int - 2000)
                )
                WHERE EXTRACT(DAY FROM date) = 25 AND EXTRACT(YEAR FROM date) != 2025
            `);
            console.log(`Updated ${updateRes.rowCount} records.`);
        } else {
            console.log("No records matched the criteria.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};

fixDates();
