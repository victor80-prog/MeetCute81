const pool = require('../config/db');

class PaymentMethod {
    /**
     * Get all global payment method types.
     * @returns {Promise<Array<Object>>} A list of payment method types.
     */
    static async getAllTypes() {
        const result = await pool.query('SELECT * FROM payment_methods ORDER BY name ASC');
        return result.rows;
    }

    /**
     * Get a global payment method type by its ID.
     * @param {number} id - The ID of the payment method type.
     * @returns {Promise<Object|null>} The payment method type or null if not found.
     */
    static async getTypeById(id, client = null) {
        const db = client || pool;
        const result = await db.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    /**
     * Get a global payment method type by its code.
     * @param {string} code - The code of the payment method type (e.g., 'MPESA', 'PAYPAL').
     * @returns {Promise<Object|null>} The payment method type or null if not found.
     */
    static async getTypeByCode(code) {
        const result = await pool.query('SELECT * FROM payment_methods WHERE code = $1', [code.toUpperCase()]);
        return result.rows[0] || null;
    }

    /**
     * Create a new global payment method type.
     * @param {Object} details - The details of the payment method type.
     * @param {string} details.name - The name of the payment method (e.g., "M-Pesa").
     * @param {string} details.code - The unique code for the payment method (e.g., "MPESA").
     * @param {string} [details.description] - Optional description.
     * @param {boolean} [details.isActive=true] - Whether the payment method is active.
     * @returns {Promise<Object>} The newly created payment method type.
     */
    static async createType({ name, code, description = null, isActive = true }) {
        const result = await pool.query(
            `INSERT INTO payment_methods (name, code, description, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, code.toUpperCase(), description, isActive]
        );
        return result.rows[0];
    }

    /**
     * Get all payment methods configured for a specific country.
     * @param {number} countryId - The ID of the country.
     * @returns {Promise<Array<Object>>} A list of payment methods configured for the country,
     * including their type details, specific instructions, and configuration.
     */
    static async getCountryPaymentMethods(countryId) {
        const query = `
            SELECT
                cpm.country_id,
                cpm.payment_method_id,
                pm.name AS payment_method_name,
                pm.code AS payment_method_code,
                pm.description AS payment_method_description,
                cpm.is_active,
                cpm.priority,
                cpm.user_instructions,
                cpm.configuration_details,
                cpm.created_at
            FROM country_payment_methods cpm
            JOIN payment_methods pm ON cpm.payment_method_id = pm.id
            WHERE cpm.country_id = $1
            ORDER BY cpm.priority ASC, pm.name ASC;
        `;
        const result = await pool.query(query, [countryId]);
        return result.rows;
    }

    /**
     * Add or configure a payment method for a specific country.
     * If it already exists, it updates it (upsert).
     * @param {Object} details - The details for configuring the country payment method.
     * @param {number} details.countryId - The ID of the country.
     * @param {number} details.paymentMethodId - The ID of the global payment method type.
     * @param {boolean} [details.isActive=true] - Whether this method is active for the country.
     * @param {number} [details.priority=0] - The display priority.
     * @param {string} [details.userInstructions] - User-facing instructions for this method in this country.
     * @param {Object} [details.configurationDetails] - JSONB object with specific config (e.g., PayBill, PayPal email).
     * @returns {Promise<Object>} The configured country payment method.
     */
    static async configureCountryPaymentMethod({
        countryId,
        paymentMethodId,
        isActive = true,
        priority = 0,
        userInstructions = null,
        configurationDetails = null
    }) {
        const query = `
            INSERT INTO country_payment_methods (
                country_id, payment_method_id, is_active, priority, user_instructions, configuration_details
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (country_id, payment_method_id) DO UPDATE SET
                is_active = EXCLUDED.is_active,
                priority = EXCLUDED.priority,
                user_instructions = EXCLUDED.user_instructions,
                configuration_details = EXCLUDED.configuration_details,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [
            countryId,
            paymentMethodId,
            isActive,
            priority,
            userInstructions,
            configurationDetails
        ]);
        // To return the joined data similar to getCountryPaymentMethods, we might need another query
        // For now, just return the direct result of the upsert.
        // A more complete version might re-fetch using a method that joins with payment_methods table.
        return result.rows[0];
    }

    /**
     * Get a specific configured payment method for a country.
     * @param {number} countryId - The ID of the country.
     * @param {number} paymentMethodId - The ID of the payment method type.
     * @returns {Promise<Object|null>} The configured payment method or null if not found.
     */
    static async getCountryPaymentMethodDetail(countryId, paymentMethodId) {
        const query = `
            SELECT
                cpm.country_id,
                cpm.payment_method_id,
                pm.name AS payment_method_name,
                pm.code AS payment_method_code,
                pm.description AS payment_method_description,
                cpm.is_active,
                cpm.priority,
                cpm.user_instructions,
                cpm.configuration_details,
                cpm.created_at
            FROM country_payment_methods cpm
            JOIN payment_methods pm ON cpm.payment_method_id = pm.id
            WHERE cpm.country_id = $1 AND cpm.payment_method_id = $2;
        `;
        const result = await pool.query(query, [countryId, paymentMethodId]);
        return result.rows[0] || null;
    }

    /**
     * Update a specific configured payment method for a country.
     * (This is technically covered by configureCountryPaymentMethod due to UPSERT,
     * but a dedicated update might be useful if partial updates are needed or
     * if ON CONFLICT is not desired in all cases for an "update" semantic).
     * For now, this can be an alias or a more specific update if needed.
     * This example assumes you might want to update without providing all fields
     * if not using ON CONFLICT's EXCLUDED.
     */
    // static async updateCountryPaymentMethod(...) { ... }


    /**
     * Remove a payment method configuration from a country.
     * @param {number} countryId - The ID of the country.
     * @param {number} paymentMethodId - The ID of the payment method type to remove.
     * @returns {Promise<Object|null>} The deleted record or null if not found.
     */
    static async removeCountryPaymentMethod(countryId, paymentMethodId) {
        const result = await pool.query(
            'DELETE FROM country_payment_methods WHERE country_id = $1 AND payment_method_id = $2 RETURNING *',
            [countryId, paymentMethodId]
        );
        return result.rows[0] || null;
    }
}

module.exports = PaymentMethod;
