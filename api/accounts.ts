import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const { name, code } = req.body;
      const result = await query(
        'INSERT INTO accounts (user_id, name, code) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, code]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { id, name, code } = req.body;
      const result = await query(
        'UPDATE accounts SET name = $1, code = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, code, id, userId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Account not found' });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
};

export default authenticated(handler);
