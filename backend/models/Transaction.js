const pool = require('../config/db');
const PaymentMethod = require('./PaymentMethod'); // To fetch payment instructions
const Subscription = require('./Subscription'); // For activating subscription

class Transaction {
    /**
     * Initiates a new transaction.
     * @param {Object} details - The details for initiating the transaction.
     * @param {number} details.userId - The ID of the user initiating.
     * @param {number} details.countryId - The ID of the country for payment method.
     * @param {number} details.paymentMethodTypeId - The ID of the global payment method type selected.
     * @param {number} details.amount - The amount for the transaction.
     * @param {string} details.currency - The currency code (e.g., 'USD', 'KES').
     * @param {string} details.itemCategory - The category of item being purchased (e.g., 'subscription', 'gift').
     * @param {number} details.payableItemId - The ID of the specific item (e.g., subscription_package_id).
     * @returns {Promise<Object>} The newly created transaction record along with payment instructions.
     * @throws {Error} If the payment method is not configured for the country or other issues.
     */
    static async initiate({
        userId,
        countryId,
        paymentMethodTypeId,
        amount,
        currency,
        itemCategory,
        payableItemId,
        description = null
    }) {
        // 1. Verify the selected payment method is configured for the country and get its details
        const paymentConfig = await PaymentMethod.getCountryPaymentMethodDetail(countryId, paymentMethodTypeId);
        if (!paymentConfig || !paymentConfig.is_active) {
            throw new Error('Selected payment method is not available or not configured for this country.');
        }

        // 2. Create the transaction record
        const transactionQuery = `
            INSERT INTO transactions (
                user_id, payment_country_id, payment_method_type_id, amount, currency,
                item_category, payable_item_id, status, description
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment', $8)
            RETURNING *;
        `;
        const transactionResult = await pool.query(transactionQuery, [
            userId,
            countryId,
            paymentMethodTypeId,
            amount,
            currency,
            itemCategory,
            payableItemId,
            description
        ]);

        const newTransaction = transactionResult.rows[0];

        return {
            transaction: newTransaction,
            paymentInstructions: paymentConfig.user_instructions,
            paymentConfigurationDetails: paymentConfig.configuration_details // e.g., PayBill, PayPal email, BTC address
        };
    }

    /**
     * Submits a payment reference for a transaction.
     * @param {Object} details - Details for submitting the reference.
     * @param {number} details.transactionId - The ID of the transaction.
     * @param {number} details.userId - The ID of the user submitting (for verification).
     * @param {string} details.userProvidedReference - The payment reference from the user.
     * @returns {Promise<Object>} The updated transaction record.
     * @throws {Error} If transaction not found, not owned by user, or not in correct state.
     */
    static async submitReference({ transactionId, userId, userProvidedReference }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch the transaction and verify ownership and status
            const currentTransactionResult = await client.query(
                'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [transactionId, userId]
            );
            const currentTransaction = currentTransactionResult.rows[0];

            if (!currentTransaction) {
                throw new Error('Transaction not found or access denied.');
            }
            if (currentTransaction.status !== 'pending_payment') {
                throw new Error(`Transaction is not awaiting payment reference (status: ${currentTransaction.status}).`);
            }

            // 2. Update the transaction
            const updateQuery = `
                UPDATE transactions
                SET user_provided_reference = $1,
                    status = 'pending_verification',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *;
            `;
            const updatedTransactionResult = await client.query(updateQuery, [userProvidedReference, transactionId]);

            await client.query('COMMIT');
            return updatedTransactionResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            if (client) { // Ensure client was acquired before releasing
                client.release();
            }
        }
    }

    /**
     * Get a transaction by its ID, ensuring it belongs to the specified user.
     * @param {number} transactionId - The ID of the transaction.
     * @param {number} userId - The ID of the user.
     * @returns {Promise<Object|null>} The transaction object or null.
     */
    static async getByIdForUser(transactionId, userId) {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
            [transactionId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Get a transaction by its ID (general purpose, typically for admin).
     * @param {number} transactionId - The ID of the transaction.
     * @param {Object} [client=null] - Optional database client.
     * @returns {Promise<Object|null>} The transaction object or null.
     */
    static async getById(transactionId, client = null) {
        const db = client || pool;
        const result = await db.query(
            'SELECT * FROM transactions WHERE id = $1',
            [transactionId]
        );
        return result.rows[0] || null;
    }

    /**
     * Fetches transactions with status = 'pending_verification'.
     * Joins with users, payment_methods, and countries for detailed info.
     * @param {number} [limit=20] - Number of records to fetch.
     * @param {number} [offset=0] - Number of records to skip for pagination.
     * @returns {Promise<{transactions: Array<Object>, totalCount: number}>} List of transactions and total count.
     */
    static async getPendingVerification(limit = 20, offset = 0) {
        const query = `
            SELECT
                t.id, t.user_id, t.amount, t.currency, t.status,
                t.item_category, t.payable_item_id, t.user_provided_reference,
                t.created_at, t.updated_at,
                u.email AS user_email,
                pm.name AS payment_method_name,
                pm.code AS payment_method_code,
                co.name AS payment_country_name
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            JOIN payment_methods pm ON t.payment_method_type_id = pm.id
            JOIN countries co ON t.payment_country_id = co.id
            WHERE t.status = 'pending_verification'
            ORDER BY t.created_at ASC
            LIMIT $1 OFFSET $2;
        `;

        const countQuery = `
            SELECT COUNT(*) FROM transactions WHERE status = 'pending_verification';
        `;

        const [transactionsResult, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);

        return {
            transactions: transactionsResult.rows,
            totalCount: parseInt(countResult.rows[0].count, 10)
        };
    }

    /**
     * Verifies a transaction and triggers fulfillment if applicable.
     * @param {Object} details - Verification details.
     * @param {number} details.transactionId - The ID of the transaction to verify.
     * @param {number} details.adminId - The ID of the admin performing the verification (for audit).
     * @param {string} details.newStatus - The new status, must be 'completed' or 'declined'.
     * @param {string} [details.adminNotes] - Optional notes from the admin.
     * @returns {Promise<Object>} The updated transaction record.
     * @throws {Error} If transaction not found, invalid newStatus, or fulfillment fails.
     */
    static async verify({ transactionId, adminId, newStatus, adminNotes, client: providedClient = null }) {
        if (newStatus !== 'completed' && newStatus !== 'declined') {
            throw new Error("Invalid new status. Must be 'completed' or 'declined'.");
        }

        const dbClient = providedClient || await pool.connect();
        const weOwnTheClient = !providedClient; // Determine if we created the client

        try {
            if (weOwnTheClient) {
                await dbClient.query('BEGIN');
            }

            // 1. Fetch the transaction to verify its current state and details
            const currentTransactionResult = await dbClient.query(
                'SELECT * FROM transactions WHERE id = $1 FOR UPDATE', // Lock the row
                [transactionId]
            );
            const currentTransaction = currentTransactionResult.rows[0];

            if (!currentTransaction) {
                throw new Error('Transaction not found.');
            }
            if (currentTransaction.status !== 'pending_verification') {
                throw new Error(`Transaction is not in 'pending_verification' status (current: ${currentTransaction.status}). Cannot verify.`);
            }

            // 2. Update the main transaction record
            const updateTransactionQuery = `
                UPDATE transactions
                SET status = $1, admin_notes = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *;
            `;
            const updatedTransactionResult = await dbClient.query(updateTransactionQuery, [
                newStatus,
                adminNotes,
                transactionId
            ]);
            const updatedTransactionDetails = updatedTransactionResult.rows[0];

            // 3. Fulfillment logic (if status is 'completed')
            if (newStatus === 'completed') {
                if (updatedTransactionDetails.item_category === 'subscription') {
                    const pmType = await PaymentMethod.getTypeById(updatedTransactionDetails.payment_method_type_id, dbClient); // Pass dbClient
                    const paymentMethodName = pmType ? pmType.name : 'Unknown';
                    try {
                        await Subscription._activateSubscriptionWorkflow(dbClient, {
                            userId: updatedTransactionDetails.user_id,
                            packageId: updatedTransactionDetails.payable_item_id,
                            originalTransactionId: updatedTransactionDetails.id,
                            paymentMethodNameForLog: paymentMethodName
                        });
                        console.log(`Subscription activation workflow completed for transaction ${transactionId}.`);
                    } catch (activationError) {
                        console.error(`CRITICAL: Fulfillment failed for transaction ${transactionId}. Error during _activateSubscriptionWorkflow: ${activationError.message}`);
                        throw new Error(`Fulfillment failed for subscription: ${activationError.message}. Transaction ${transactionId} needs review.`);
                    }
                } else if (updatedTransactionDetails.item_category === 'deposit' || 
                           (updatedTransactionDetails.item_category === 'gift' && updatedTransactionDetails.description === 'deposit')) {
                    const updateBalanceQuery = `
                        INSERT INTO user_balances (user_id, balance)
                        VALUES ($1, $2)
                        ON CONFLICT (user_id) 
                        DO UPDATE SET 
                            balance = user_balances.balance + EXCLUDED.balance,
                            updated_at = NOW()
                        RETURNING balance, user_id;
                    `;
                    const balanceResult = await dbClient.query(updateBalanceQuery, [
                        updatedTransactionDetails.user_id,
                        updatedTransactionDetails.amount
                    ]);
                    console.log(`Balance updated for user ${balanceResult.rows[0].user_id}. New balance: ${balanceResult.rows[0].balance}`);
                }
            }

            if (weOwnTheClient) {
                await dbClient.query('COMMIT');
            }
            return updatedTransactionDetails;

        } catch (error) {
            if (weOwnTheClient) {
                try {
                    await dbClient.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('Error during ROLLBACK:', rollbackError);
                    // Optionally, rethrow or handle rollback error specifically
                }
            }
            console.error(`Error verifying transaction ${transactionId}:`, error.message);
            throw error; // Re-throw the original error to be handled by the controller
        } finally {
            if (weOwnTheClient) {
                dbClient.release();
            }
        }
    }

    /**
     * Fetches all transactions for a given userId with pagination.
     * Joins with payment_methods and countries.
     * @param {Object} params - Parameters for listing transactions.
     * @param {number} params.userId - The ID of the user.
     * @param {number} [params.limit=10] - Number of records to fetch.
     * @param {number} [params.offset=0] - Number of records to skip.
     * @returns {Promise<{transactions: Array<Object>, totalCount: number}>} List of transactions and total count.
     */
    static async listByUserId({ userId, limit = 10, offset = 0 }) {
        const query = `
            WITH user_balance AS (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN t.item_category IN ('deposit', 'gift') AND t.status = 'completed' THEN t.amount
                        WHEN t.item_category = 'withdrawal' AND t.status = 'completed' THEN -t.amount
                        ELSE 0 
                    END
                ), 0) as balance
                FROM transactions t
                WHERE t.user_id = $1
            )
            SELECT
                t.id,
                t.user_id,
                t.amount,
                t.currency,
                t.status,
                t.item_category,
                t.payable_item_id,
                t.user_provided_reference,
                t.admin_notes,
                t.created_at,
                t.updated_at,
                pm.name AS payment_method_name,
                pm.code AS payment_method_code,
                co.name AS payment_country_name,
                (SELECT balance FROM user_balance) as current_balance
            FROM transactions t
            LEFT JOIN payment_methods pm ON t.payment_method_type_id = pm.id
            LEFT JOIN countries co ON t.payment_country_id = co.id
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
            LIMIT $2 OFFSET $3;
        `;

        const countQuery = `
            SELECT COUNT(*) FROM transactions WHERE user_id = $1;
        `;

        const [transactionsResult, countResult] = await Promise.all([
            pool.query(query, [userId, limit, offset]),
            pool.query(countQuery, [userId])
        ]);

        return {
            transactions: transactionsResult.rows,
            totalCount: parseInt(countResult.rows[0].count, 10)
        };
    }
}

/**
 * Submits a payment reference for a transaction.
 * @param {number} transactionId - The ID of the transaction.
 * @param {string} reference - The payment reference from the user.
 * @returns {Promise<Object>} The updated transaction record.
 */
Transaction.submitPaymentReference = async (transactionId, reference) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // First, get the current transaction details
        const getTxQuery = `
            SELECT id, user_id, item_category, description, status 
            FROM transactions 
            WHERE id = $1 
            FOR UPDATE`;
            
        const txResult = await client.query(getTxQuery, [transactionId]);
        
        if (txResult.rows.length === 0) {
            throw new Error('Transaction not found');
        }
        
        const transaction = txResult.rows[0];
        
        // Check if transaction is a deposit (either item_category='deposit' or item_category='gift' with description='deposit')
        const isDepositTransaction = (
            transaction.item_category === 'deposit' || 
            (transaction.item_category === 'gift' && transaction.description === 'deposit')
        );
        
        if (!isDepositTransaction) {
            throw new Error('Invalid transaction type. Must be a deposit transaction.');
        }
        
        // Check if transaction is already completed
        if (transaction.status === 'completed' || transaction.status === 'declined') {
            throw new Error(`Cannot submit reference. Transaction is already ${transaction.status}.`);
        }
        
        // Update the transaction with the reference and set status to pending_verification
        const updateQuery = `
            UPDATE transactions 
            SET user_provided_reference = $1, 
                status = 'pending_verification', 
                updated_at = NOW() 
            WHERE id = $2 
            RETURNING *`;
            
        const result = await client.query(updateQuery, [reference, transactionId]);
        
        if (result.rows.length === 0) {
            throw new Error('Failed to update transaction with payment reference');
        }
        
        await client.query('COMMIT');
        return result.rows[0];
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in submitPaymentReference:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Create an object with all the static methods
const transactionMethods = {
    initiate: Transaction.initiate,
    submitPaymentReference: Transaction.submitPaymentReference,
    getById: Transaction.getById,
    getByIdForUser: Transaction.getByIdForUser,
    updateStatus: Transaction.updateStatus,
    listByUserId: Transaction.listByUserId,
    getPendingVerification: Transaction.getPendingVerification,
    verify: Transaction.verify
    // All static methods are now exported
};

module.exports = transactionMethods;
