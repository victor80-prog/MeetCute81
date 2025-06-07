const pool = require('../config/db');
const UserBalance = require('./UserBalance'); // For debiting balance

class WithdrawalRequest {
    static async createRequest({ userId, amount, paymentDetails }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check and debit user's balance
            // UserBalance.debit will throw an error if insufficient, rolling back the transaction.
            const newBalanceState = await UserBalance.debit(userId, parseFloat(amount), client);

            // 2. Create withdrawal request
            const result = await client.query(
                `INSERT INTO withdrawal_requests (user_id, amount, payment_details, status, created_at)
                 VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP) RETURNING *`,
                [userId, parseFloat(amount), paymentDetails]
            );

            await client.query('COMMIT');
            return { request: result.rows[0], newBalance: newBalanceState.balance };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error creating withdrawal request:', error.message, error.stack);
            throw error; // Re-throw to be handled by controller
        } finally {
            client.release();
        }
    }

    static async getById(requestId, client = pool) {
        const result = await client.query('SELECT * FROM withdrawal_requests WHERE id = $1', [requestId]);
        return result.rows[0];
    }

    static async getByUserId(userId, client = pool) {
        const result = await client.query(
            'SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }

    static async getAll(client = pool) { // For admin
        const result = await client.query(`
            SELECT 
                wr.*, 
                u.email as user_email,
                wr.created_at,
                wr.processed_at
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            ORDER BY wr.created_at DESC
        `);
        return result.rows;
    }

    static async getByStatus(status, client = pool) { // For admin
         const result = await client.query(`
            SELECT 
                wr.*, 
                u.email as user_email,
                wr.created_at,
                wr.processed_at
            FROM withdrawal_requests wr
            JOIN users u ON wr.user_id = u.id
            WHERE wr.status = $1
            ORDER BY wr.created_at DESC
        `, [status]);
        return result.rows;
    }

    static async updateStatus({ requestId, newStatus, adminId, adminNotes = null }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const request = await this.getById(requestId, client); // Use FOR UPDATE if concurrent updates are a concern on this specific request
            if (!request) {
                throw new Error('Withdrawal request not found.');
            }

            // If rejecting a request where balance was already debited, credit it back.
            // This logic assumes 'pending' status means balance was debited at creation.
            if (newStatus === 'rejected' && request.status === 'pending') {
                await UserBalance.credit(request.user_id, parseFloat(request.amount), client);
            } else if (newStatus === 'rejected' && request.status === 'approved' ) {
                // If it was 'approved' and is now 'rejected', it implies it wasn't 'processed'.
                // If 'processed' implies money sent, then rejecting after 'processed' is complex and needs careful thought.
                // For now, assume 'approved' can be rolled back by refunding.
                await UserBalance.credit(request.user_id, parseFloat(request.amount), client);
            }
            // Note: If newStatus is 'processed', the money is assumed to be sent externally.
            // No balance change here; that happened at request creation or if it was 'approved' and now 'processed'.
            // If 'approved' status itself triggered an external hold or some other action, that logic would be here too.

            const result = await client.query(
                `UPDATE withdrawal_requests
                 SET status = $1, processed_at = CURRENT_TIMESTAMP, processed_by = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 RETURNING *`,
                [newStatus, adminId, requestId]
            );
            
            // If we need to store admin notes in the future, we'll need to add the admin_notes column
            // For now, we'll just log the notes to the console
            if (adminNotes) {
                console.log(`Admin notes for withdrawal request ${requestId}:`, adminNotes);
            }

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error updating withdrawal request ${requestId} to ${newStatus}:`, error.message, error.stack);
            throw error;
        } finally {
            client.release();
        }
    }
}
module.exports = WithdrawalRequest;
