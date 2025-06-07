const pool = require('../config/db');
const UserBalance = require('../models/UserBalance');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction'); // Assuming Transaction model can log this

class SubscriptionService {
    /**
     * Allows a user to purchase a subscription package using their account balance.
     * This method handles the entire workflow within a database transaction:
     * 1. Fetches package details (price).
     * 2. Checks user's current balance.
     * 3. Debits the package price from the user's balance.
     * 4. Creates a 'completed' transaction record for this internal purchase.
     * 5. Activates the subscription for the user.
     *
     * @param {number} userId - The ID of the user purchasing the subscription.
     * @param {number} packageId - The ID of the subscription package to purchase.
     * @returns {Promise<Object>} An object containing the new user subscription and the transaction record.
     * @throws {Error} If the package is not found, balance is insufficient, or any part of the process fails.
     */
    static async purchaseSubscriptionWithBalance(userId, packageId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch package details (price, currency - assuming currency is fixed or part of package)
            const subscriptionPackage = await Subscription.getPackageById(packageId, client);
            if (!subscriptionPackage) {
                throw new Error('Subscription package not found.');
            }
            const packagePrice = parseFloat(subscriptionPackage.price);
            // Assuming a default currency or that currency is handled/stored with package or balance
            const currency = subscriptionPackage.currency || 'USD'; // Or fetch from config/balance

            // 2. Check user's current balance (and ensure account exists)
            const balanceAccount = await UserBalance.getOrCreateByUserId(userId, client);
            const currentBalance = parseFloat(balanceAccount.balance);

            if (currentBalance < packagePrice) {
                throw new Error(`Insufficient balance. Current: ${currentBalance}, Required: ${packagePrice}`);
            }

            // 3. Debit the package price from user's balance
            // The UserBalance.debit method already checks for sufficient funds and throws an error if needed.
            await UserBalance.debit(userId, packagePrice, client);
            console.log(`Successfully debited ${packagePrice} from user ${userId} for package ${packageId}`);

            // 4. Create a 'completed' transaction record for this internal purchase
            // We need a way to log this in the main transactions table.
            // Assuming Transaction.createInternal or similar exists, or we adapt Transaction.initiate
            // For now, let's assume we can directly insert a simplified transaction record.
            // This part might need refinement based on how `Transaction.initiate` or a similar method works.
            const transactionDescription = `Subscription purchase: ${subscriptionPackage.name} (from balance)`;
            const transactionInsertQuery = `
                INSERT INTO transactions (
                    user_id, payment_country_id, payment_method_type_id, amount, currency,
                    item_category, payable_item_id, status, description, 
                    user_provided_reference, admin_notes
                )
                VALUES ($1, NULL, NULL, $2, $3, 'subscription', $4, 'completed', $5, 'PAID_FROM_BALANCE', 'Paid from account balance')
                RETURNING *;
            `;
            // Note: payment_country_id and payment_method_type_id are NULL as this is an internal balance transaction.
            const transactionResult = await client.query(transactionInsertQuery, [
                userId,
                packagePrice,
                currency, // Ensure this currency matches what UserBalance.debit expects if it considers currency
                packageId,
                transactionDescription
            ]);
            const newTransactionRecord = transactionResult.rows[0];
            if (!newTransactionRecord) {
                throw new Error('Failed to create transaction record for balance-based subscription purchase.');
            }
            console.log(`Created transaction record ${newTransactionRecord.id} for balance purchase.`);

            // 5. Activate the subscription
            const userSubscription = await Subscription._activateSubscriptionWorkflow(client, {
                userId,
                packageId,
                originalTransactionId: newTransactionRecord.id, // Link to the new internal transaction
                paymentMethodNameForLog: 'Account Balance'
            });
            console.log(`Subscription ${userSubscription.id} activated for user ${userId} via balance.`);

            await client.query('COMMIT');
            return {
                userSubscription,
                transactionRecord: newTransactionRecord,
                message: 'Subscription purchased successfully from account balance.'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error purchasing subscription with balance for user ${userId}, package ${packageId}:`, error);
            // Re-throw a more user-friendly or specific error if needed
            throw new Error(`Failed to purchase subscription with balance: ${error.message}`);
        } finally {
            if (client) {
                client.release();
            }
        }
    }
}

module.exports = SubscriptionService;
