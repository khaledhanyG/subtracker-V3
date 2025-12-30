import { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../db/index.js';
import { authenticated } from '../lib/auth.js';

const handler = async (req: VercelRequest, res: VercelResponse, user: any) => {
  const userId = user.userId;

  try {
    if (req.method === 'POST') {
      const {
        name, baseAmount, billingCycle, userCount, notes, status,
        allocationType, departments, accountAllocationType, accounts,
        startDate, nextRenewalDate
      } = req.body;

      // Note: mapping camelCase to snake_case for DB
      const result = await query(
        `INSERT INTO subscriptions (
          user_id, name, base_amount, billing_cycle, user_count, notes, status,
          allocation_type, departments, account_allocation_type, accounts,
          start_date, next_renewal_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          userId, name, baseAmount, billingCycle, userCount, notes, status,
          allocationType, JSON.stringify(departments), accountAllocationType, JSON.stringify(accounts),
          startDate, nextRenewalDate
        ]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      // Simplified PUT for brevity, mainly used for simple field updates, not complex logic yet
      // In a real app we'd map all fields carefully.
      const { id, ...updates } = req.body;
      // This naive dynamic query might fail if field names don't match DB columns perfectly.
      // For safe execution, let's just support critical updates or use manual mapping.

      // Mapping known camelCase to snake_case
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.baseAmount) dbUpdates.base_amount = updates.baseAmount;
      if (updates.billingCycle) dbUpdates.billing_cycle = updates.billingCycle;
      if (updates.nextRenewalDate) dbUpdates.next_renewal_date = updates.nextRenewalDate;
      if (updates.lastPaymentDate) dbUpdates.last_payment_date = updates.lastPaymentDate;
      if (updates.lastPaymentAmount) dbUpdates.last_payment_amount = updates.lastPaymentAmount;

      // Fix: Add Missing Fields
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.userCount) dbUpdates.user_count = updates.userCount;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes; // Allow empty string
      if (updates.startDate) dbUpdates.start_date = updates.startDate;

      if (updates.allocationType) dbUpdates.allocation_type = updates.allocationType;
      if (updates.departments) dbUpdates.departments = JSON.stringify(updates.departments);

      if (updates.accountAllocationType) dbUpdates.account_allocation_type = updates.accountAllocationType;
      if (updates.accounts) dbUpdates.accounts = JSON.stringify(updates.accounts);

      const keys = Object.keys(dbUpdates);
      if (keys.length === 0 && Object.keys(updates).length > 0) {
        // Fallback for fields that match exactly or check logs
      }

      if (keys.length > 0) {
        const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
        const values = keys.map(key => dbUpdates[key]);

        const result = await query(
          `UPDATE subscriptions SET ${setClause} WHERE id = $1 AND user_id = $${keys.length + 2} RETURNING *`,
          [id, ...values, userId]
        );
        return res.status(200).json(result.rows[0]);
      }
      return res.status(200).json({ message: 'No updates performed' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await query('DELETE FROM subscriptions WHERE id = $1 AND user_id = $2', [id, userId]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default authenticated(handler);
