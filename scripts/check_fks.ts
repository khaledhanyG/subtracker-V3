import pg from 'pg';

const DATABASE_URL = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = pg;

const checkFKs = async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();
    try {
        console.log("Checking tables referencing 'transactions'...");
        const res = await client.query(`
            SELECT
                tc.table_schema, 
                tc.constraint_name, 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='transactions';
        `);

        if (res.rows.length === 0) {
            console.log("No tables reference 'transactions'. Safe to update PK IDs (if you handle code references).");
        } else {
            console.log("Dependencies found:");
            console.table(res.rows);
        }
    } catch (e) { console.error(e); }
    finally { client.release(); await pool.end(); }
};
checkFKs();
