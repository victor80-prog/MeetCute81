const pool = require('../config/db');

class UserBalance {
    static async getByUserId(userId, client = pool) {
        const res = await client.query('SELECT * FROM user_balances WHERE user_id = $1', [userId]);
        return res.rows[0];
    }

    static async getOrCreateByUserId(userId, client = pool) {
        let balanceAccount = await this.getByUserId(userId, client);
        if (!balanceAccount) {
            const res = await client.query(
                'INSERT INTO user_balances (user_id, balance) VALUES ($1, 0.00) RETURNING *',
                [userId]
            );
            balanceAccount = res.rows[0];
        }
        return balanceAccount;
    }

    static async updateBalance(userId, amountChange, client = pool) { // amountChange can be positive or negative
        const balanceAccount = await this.getOrCreateByUserId(userId, client);
        const newBalance = parseFloat(balanceAccount.balance) + parseFloat(amountChange);
        if (newBalance < 0) {
            throw new Error('Insufficient balance.');
        }
        const res = await client.query(
            'UPDATE user_balances SET balance = $1 WHERE user_id = $2 RETURNING *',
            [newBalance.toFixed(2), userId]
        );
        return res.rows[0];
    }

    // Specific credit/debit methods can be more explicit
    static async credit(userId, amount, client = pool) {
        if (parseFloat(amount) < 0) throw new Error('Credit amount must be positive.');
        return this.updateBalance(userId, amount, client);
    }

    static async debit(userId, amount, client = pool) {
        if (parseFloat(amount) < 0) throw new Error('Debit amount must be positive.');
        return this.updateBalance(userId, -amount, client);
    }
}
module.exports = UserBalance;
