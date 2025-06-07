const UserBalance = require('../models/UserBalance');
const WithdrawalRequest = require('../models/WithdrawalRequest');

exports.getUserBalance = async (req, res) => {
    try {
        console.log('getUserBalance called with user:', req.user);
        
        if (!req.user || !req.user.id) {
            console.error('No user ID in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userId = req.user.id;
        console.log('Fetching balance for user ID:', userId);
        
        try {
            const balanceAccount = await UserBalance.getOrCreateByUserId(userId);
            console.log('Retrieved balance account:', balanceAccount);
            
            if (!balanceAccount) {
                console.error('Failed to get or create balance account');
                return res.status(500).json({ error: 'Failed to initialize balance account' });
            }
            
            const balance = parseFloat(balanceAccount.balance).toFixed(2);
            console.log('Returning balance:', balance);
            return res.json({ balance });
            
        } catch (dbError) {
            console.error('Database error in getUserBalance:', {
                message: dbError.message,
                stack: dbError.stack,
                userId: userId
            });
            return res.status(500).json({ 
                error: 'Database error',
                details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }
        
    } catch (error) {
        console.error('Unexpected error in getUserBalance:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.id
        });
        return res.status(500).json({ 
            error: 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.requestWithdrawal = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, paymentDetails } = req.body;

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Invalid withdrawal amount.' });
        }
        if (!paymentDetails || typeof paymentDetails !== 'string' || paymentDetails.trim() === '') {
            return res.status(400).json({ error: 'Payment details are required and must be a non-empty string.' });
        }

        // Optional: Add a minimum withdrawal amount check here if desired
        const MIN_WITHDRAWAL_AMOUNT = 1.00; // Example: Minimum $1.00
        if (parseFloat(amount) < MIN_WITHDRAWAL_AMOUNT) {
           return res.status(400).json({ error: `Minimum withdrawal amount is $${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.` });
        }

        const result = await WithdrawalRequest.createRequest({
            userId,
            amount: parseFloat(amount).toFixed(2),
            paymentDetails
        });
        res.status(201).json({
            message: 'Withdrawal request submitted successfully.',
            requestId: result.request.id,
            newBalance: parseFloat(result.newBalance).toFixed(2)
        });
    } catch (error) {
        console.error('Error submitting withdrawal request:', error.message, error.stack);
        if (error.message.includes('Insufficient balance')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to submit withdrawal request.' });
    }
};

exports.getUserWithdrawalRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await WithdrawalRequest.getByUserId(userId);
        res.json(requests);
    } catch (error)
    {
        console.error('Error fetching user withdrawal requests:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch withdrawal requests.' });
    }
};
