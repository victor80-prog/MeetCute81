const Transaction = require('../models/Transaction');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const db = require('../config/db');

/**
 * Controller for handling deposit-related operations
 */

/**
 * Initiates a deposit transaction
 * @route POST /api/deposits/initiate
 */
exports.initiateDeposit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, paymentMethodId, countryId } = req.body;

        // Validate required inputs
        if (!amount || !paymentMethodId || !countryId) {
            return res.status(400).json({ message: 'Missing required fields: amount, paymentMethodId, countryId' });
        }

        // Validate amount
        const depositAmount = parseFloat(amount);
        if (isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).json({ message: 'Invalid amount. Must be a positive number.' });
        }

        // Create a new transaction record for the deposit
        const transaction = await Transaction.initiate({
            userId,
            amount: depositAmount,
            itemCategory: 'deposit', // Using 'deposit' as the item category
            payableItemId: 1, // Placeholder ID for deposits
            paymentMethodTypeId: paymentMethodId, // Match the parameter name expected by Transaction.initiate
            countryId,
            description: 'deposit', // Mark this transaction as a deposit
            currency: req.body.currency || 'USD' // Include currency from request
        });

        // Get payment method details
        const countryPaymentMethods = await PaymentMethod.getCountryPaymentMethods(countryId);
        const selectedMethod = countryPaymentMethods.find(method => 
            method.payment_method_id.toString() === paymentMethodId.toString());
        
        if (!selectedMethod) {
            return res.status(404).json({ message: 'Payment method not found or not available for the selected country' });
        }

        // Format payment instructions
        console.log('Selected method:', JSON.stringify(selectedMethod, null, 2));
        
        // Make sure we have payment instructions even if user_instructions is missing
        let paymentInstructions = '';
        if (selectedMethod.user_instructions) {
            paymentInstructions = selectedMethod.user_instructions.replace('{{amount}}', depositAmount.toFixed(2));
        } else {
            paymentInstructions = `Please send ${depositAmount.toFixed(2)} using the selected payment method and provide the reference number.`;
        }
        
        console.log('Generated payment instructions:', paymentInstructions);

        // Ensure we have a valid transaction object
        if (!transaction || !transaction.transaction || !transaction.transaction.id) {
            console.error('Invalid transaction object returned from Transaction.initiate:', transaction);
            return res.status(500).json({ 
                message: 'Failed to create transaction',
                details: 'Invalid transaction data returned from database'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Deposit transaction initiated successfully',
            transaction: transaction.transaction,
            paymentMethod: selectedMethod.payment_method_name,
            paymentInstructions: paymentInstructions,
            paymentConfigurationDetails: selectedMethod.configuration_details || {}
        });
    } catch (error) {
        console.error('Error initiating deposit:', error);
        return res.status(500).json({ message: 'Failed to initiate deposit', error: error.message });
    }
};
/**
 * Verifies a deposit transaction after user submits payment reference
 * @route POST /api/deposits/verify
 */
exports.verifyDeposit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { transactionId, reference } = req.body;
        
        console.log('Verify deposit request:', { userId, transactionId, reference });

        // Validate required inputs
        if (!transactionId || !reference) {
            return res.status(400).json({ message: 'Missing required fields: transactionId, reference' });
        }

        // Check if transaction exists and belongs to the user
        console.log('Looking for transaction with ID:', transactionId, 'for user:', userId);
        const transaction = await Transaction.getByIdForUser(transactionId, userId);
        
        if (!transaction) {
            console.log('Transaction not found for ID:', transactionId);
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Check if transaction is a deposit (either item_category='deposit' or item_category='gift' with description='deposit' for backward compatibility)
        const isDepositTransaction = (
            transaction.item_category === 'deposit' || 
            (transaction.item_category === 'gift' && transaction.description === 'deposit')
        );
        
        if (!isDepositTransaction) {
            return res.status(400).json({ 
                message: 'Invalid transaction type. Must be a deposit transaction.',
                details: {
                    item_category: transaction.item_category,
                    description: transaction.description
                }
            });
        }

        // Check if transaction is already completed
        if (transaction.status === 'completed') {
            return res.status(400).json({ message: 'Transaction already completed' });
        }

        // Submit payment reference
        await Transaction.submitPaymentReference(transactionId, reference);

        // The transaction is now in 'pending_verification' status
        // Admin will verify the payment and update the status to 'completed' or 'rejected'

        return res.status(200).json({
            message: 'Deposit reference submitted successfully. Your deposit is pending verification.',
            transactionId
        });
    } catch (error) {
        console.error('Error verifying deposit:', error);
        return res.status(500).json({ message: 'Failed to verify deposit', error: error.message });
    }
};

/**
 * Lists all deposits for the authenticated user
 * @route GET /api/deposits
 */
exports.listDeposits = async (req, res) => {
    try {
        const userId = req.user.id;
        let { limit = 10, offset = 0 } = req.query;
        
        // Parse and validate pagination parameters
        limit = parseInt(limit);
        offset = parseInt(offset);
        
        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ message: 'Invalid limit parameter. Must be a positive number.' });
        }
        
        if (isNaN(offset) || offset < 0) {
            return res.status(400).json({ message: 'Invalid offset parameter. Must be a non-negative number.' });
        }

        // For debugging, first check if the transactions table exists and has the expected columns
        try {
            const tableCheck = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'transactions'
            `);
            console.log('Transactions table columns:', tableCheck.rows.map(r => r.column_name));
        } catch (error) {
            console.error('Error checking transactions table:', error);
        }

        // Query to get deposits with pagination
        // Note: We're using 'gift' as the item_category because of database constraints,
        // but we'll filter for deposits based on the description field
        const query = `
            SELECT id, amount, status, created_at, user_provided_reference as reference
            FROM transactions
            WHERE user_id = $1 AND ((item_category = 'deposit') OR (item_category = 'gift' AND description = 'deposit'))
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const countQuery = `
            SELECT COUNT(*) as total
            FROM transactions
            WHERE user_id = $1 AND ((item_category = 'deposit') OR (item_category = 'gift' AND description = 'deposit'))
        `;

        const result = await db.query(query, [userId, limit, offset]);
        const countResult = await db.query(countQuery, [userId]);
        
        const totalCount = parseInt(countResult.rows[0].total);
        
        // For now, if there are no real deposits, return some dummy data for testing
        if (result.rows.length === 0) {
            const dummyDeposits = [
                {
                    id: 1001,
                    amount: 50.00,
                    status: 'completed',
                    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                    reference: 'REF123456'
                },
                {
                    id: 1002,
                    amount: 100.00,
                    status: 'pending_verification',
                    created_at: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
                    reference: 'REF789012'
                }
            ];
            
            return res.status(200).json({
                deposits: dummyDeposits,
                totalCount: dummyDeposits.length,
                message: "Dummy deposits retrieved for testing"
            });
        }
        
        return res.status(200).json({
            deposits: result.rows,
            totalCount,
            message: "Deposits retrieved successfully"
        });
    } catch (error) {
        console.error('Error listing deposits:', error);
        return res.status(500).json({ message: 'Failed to list deposits', error: error.message });
    }
};

/**
 * Admin endpoint to list all pending deposit verifications
 * @route GET /api/admin/deposits/pending-verification
 */
exports.listPendingVerificationDeposits = async (req, res) => {
    try {
        // This endpoint should be protected by admin middleware
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const query = `
            SELECT t.id, t.user_id, t.amount, t.reference, t.created_at, 
                   u.username, u.email
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.status = 'pending_verification' AND t.item_category = 'deposit'
            ORDER BY t.created_at ASC
        `;

        const result = await db.query(query);
        
        return res.status(200).json({
            pendingDeposits: result.rows,
            message: "Pending deposits retrieved successfully"
        });
    } catch (error) {
        console.error('Error listing pending verification deposits:', error);
        return res.status(500).json({ message: 'Failed to list pending deposits', error: error.message });
    }
};

/**
 * Admin endpoint to approve or reject a deposit
 * @route POST /api/admin/deposits/:transactionId/verify
 */
exports.verifyDepositByAdmin = async (req, res) => {
    try {
        // This endpoint should be protected by admin middleware
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const { transactionId } = req.params;
        const { action, note } = req.body;

        // Validate required inputs
        if (!transactionId || !action) {
            return res.status(400).json({ message: 'Missing required fields: transactionId, action' });
        }

        // Validate action
        if (action !== 'approve' && action !== 'reject') {
            return res.status(400).json({ message: 'Invalid action. Must be either "approve" or "reject".' });
        }

        // Get transaction details
        const transaction = await Transaction.getById(transactionId);
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Check if transaction is of type 'deposit' or 'gift' (for backward compatibility)
        if (transaction.item_category !== 'deposit' && transaction.item_category !== 'gift') {
            return res.status(400).json({ message: 'Invalid transaction type. Must be a deposit or gift transaction.' });
        }

        // Check if transaction is in pending_verification status
        if (transaction.status !== 'pending_verification') {
            return res.status(400).json({ message: 'Transaction is not pending verification' });
        }

        if (action === 'approve') {
            const client = await db.getClient();
            try {
                await client.query('BEGIN');
                
                // First, update the transaction status
                const updatedTransaction = await Transaction.verify({
                    transactionId,
                    adminId: req.user.id,
                    newStatus: 'completed',
                    adminNotes: note || 'Deposit approved'
                });
                
                // Get the updated user balance from user_balances table
                const balanceQuery = `
                    INSERT INTO user_balances (user_id, balance)
                    VALUES ($1, $2)
                    ON CONFLICT (user_id) 
                    DO UPDATE SET 
                        balance = user_balances.balance + EXCLUDED.balance,
                        updated_at = NOW()
                    RETURNING balance;
                `;
                
                const balanceResult = await client.query(balanceQuery, [
                    transaction.user_id,
                    transaction.amount
                ]);
                
                const newBalance = balanceResult.rows[0] ? balanceResult.rows[0].balance : 0;
                
                await client.query('COMMIT');
                
                return res.status(200).json({
                    success: true,
                    message: 'Deposit approved successfully',
                    transactionId,
                    newBalance,
                    transaction: updatedTransaction
                });
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error in verifyDepositByAdmin:', error);
                throw error;
            } finally {
                client.release();
            }
        } else {
            // Reject the deposit
            await Transaction.verify({
                transactionId,
                adminId: req.user.id,
                newStatus: 'rejected',
                adminNotes: note || 'Deposit rejected'
            });
            
            return res.status(200).json({
                success: true,
                message: 'Deposit rejected',
                transactionId,
                status: 'rejected'
            });
        }
    } catch (error) {
        console.error('Error verifying deposit by admin:', error);
        return res.status(500).json({ message: 'Failed to verify deposit', error: error.message });
    }
};
