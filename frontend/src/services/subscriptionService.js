import { get, post, put, del } from '../utils/apiClient';

/**
 * Get all available subscription plans
 * @returns {Promise<Array>} List of subscription plans
 */
export const getSubscriptionPlans = async () => {
  return get('/subscriptions/plans');
};

/**
 * Get current user's active subscription
 * @returns {Promise<Object>} Current subscription details
 */
export const getMySubscription = async () => {
  return get('/subscriptions/me');
};

/**
 * Subscribe to a plan
 * @param {string} planId - ID of the plan to subscribe to
 * @param {Object} paymentMethod - Payment method details
 * @returns {Promise<Object>} Subscription confirmation
 */
export const subscribe = async (planId, paymentMethod) => {
  return post('/subscriptions/subscribe', { planId, paymentMethod });
};

/**
 * Update subscription plan
 * @param {string} newPlanId - ID of the new plan
 * @returns {Promise<Object>} Updated subscription details
 */
export const updateSubscription = async (newPlanId) => {
  return put('/subscriptions/update', { newPlanId });
};

/**
 * Cancel subscription
 * @param {string} [reason=''] - Reason for cancellation
 * @returns {Promise<Object>} Cancellation confirmation
 */
export const cancelSubscription = async (reason = '') => {
  return post('/subscriptions/cancel', { reason });
};

/**
 * Reactivate cancelled subscription
 * @returns {Promise<Object>} Reactivation confirmation
 */
export const reactivateSubscription = async () => {
  return post('/subscriptions/reactivate');
};

/**
 * Get subscription invoices
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Items per page
 * @returns {Promise<Object>} Paginated list of invoices
 */
export const getInvoices = async (page = 1, limit = 10) => {
  return get('/subscriptions/invoices', { page, limit });
};

/**
 * Get specific invoice by ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice details
 */
export const getInvoiceById = async (invoiceId) => {
  return get(`/subscriptions/invoices/${invoiceId}`);
};

/**
 * Update payment method
 * @param {Object} paymentMethod - New payment method details
 * @returns {Promise<Object>} Updated payment method
 */
export const updatePaymentMethod = async (paymentMethod) => {
  return put('/subscriptions/payment-method', { paymentMethod });
};

/**
 * Get subscription usage metrics
 * @returns {Promise<Object>} Usage metrics
 */
export const getUsageMetrics = async () => {
  return get('/subscriptions/usage');
};

/**
 * Get subscription features
 * @param {string} [planId] - Optional plan ID to filter features
 * @returns {Promise<Array>} List of subscription features
 */
export const getSubscriptionFeatures = async (planId) => {
  const params = planId ? { planId } : undefined;
  return get('/subscriptions/features', params);
};

/**
 * Check if a specific feature is available
 * @param {string} featureName - Name of the feature to check
 * @returns {Promise<boolean>} True if the feature is available
 */
export const isFeatureAvailable = async (featureName) => {
  try {
    const response = await get(`/subscriptions/features/${featureName}/check`);
    return response.data?.available || false;
  } catch (error) {
    console.error(`Error checking feature ${featureName}:`, error);
    return false;
  }
};

/**
 * Get subscription status
 * @returns {Promise<Object>} Subscription status information
 */
export const getSubscriptionStatus = async () => {
  return get('/subscriptions/status');
};

/**
 * Get subscription upgrade options
 * @returns {Promise<Array>} Available upgrade options
 */
export const getUpgradeOptions = async () => {
  return get('/subscriptions/upgrade-options');
};

/**
 * Apply a promo code to subscription
 * @param {string} promoCode - Promo code to apply
 * @returns {Promise<Object>} Promo code application result
 */
export const applyPromoCode = async (promoCode) => {
  return post('/subscriptions/apply-promo', { promoCode });
};
