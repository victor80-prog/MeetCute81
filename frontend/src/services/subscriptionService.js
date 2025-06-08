import { get, post, put, del } from '../utils/apiClient';

/**
 * Get all available subscription plans
 * @returns {Promise<Array>} List of subscription plans
 */
export const getSubscriptionPlans = async () => {
  return get('/api/subscriptions/plans');
};

/**
 * Get current user's active subscription
 * @returns {Promise<Object>} Current subscription details
 */
export const getMySubscription = async () => {
  return get('/api/subscriptions/me');
};

/**
 * Subscribe to a plan
 * @param {string} planId - ID of the plan to subscribe to
 * @param {Object} paymentMethod - Payment method details
 * @returns {Promise<Object>} Subscription confirmation
 */
export const subscribe = async (planId, paymentMethod) => {
  return post('/api/subscriptions/subscribe', { planId, paymentMethod });
};

/**
 * Update subscription plan
 * @param {string} newPlanId - ID of the new plan
 * @returns {Promise<Object>} Updated subscription details
 */
export const updateSubscription = async (newPlanId) => {
  return put('/api/subscriptions/update', { newPlanId });
};

/**
 * Cancel subscription
 * @param {string} [reason=''] - Reason for cancellation
 * @returns {Promise<Object>} Cancellation confirmation
 */
export const cancelSubscription = async (reason = '') => {
  return post('/api/subscriptions/cancel', { reason });
};

/**
 * Reactivate cancelled subscription
 * @returns {Promise<Object>} Reactivation confirmation
 */
export const reactivateSubscription = async () => {
  return post('/api/subscriptions/reactivate');
};

/**
 * Get subscription invoices
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Items per page
 * @returns {Promise<Object>} Paginated list of invoices
 */
export const getInvoices = async (page = 1, limit = 10) => {
  return get('/api/subscriptions/invoices', { page, limit });
};

/**
 * Get specific invoice by ID
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<Object>} Invoice details
 */
export const getInvoiceById = async (invoiceId) => {
  return get(`/api/subscriptions/invoices/${invoiceId}`);
};

/**
 * Update payment method
 * @param {Object} paymentMethod - New payment method details
 * @returns {Promise<Object>} Updated payment method
 */
export const updatePaymentMethod = async (paymentMethod) => {
  return put('/api/subscriptions/payment-method', { paymentMethod });
};

/**
 * Get subscription usage metrics
 * @returns {Promise<Object>} Usage metrics
 */
export const getUsageMetrics = async () => {
  return get('/api/subscriptions/usage');
};

/**
 * Get subscription features
 * @param {string} [planId] - Optional plan ID to filter features
 * @returns {Promise<Array>} List of subscription features
 */
export const getSubscriptionFeatures = async (planId) => {
  const params = planId ? { planId } : {};
  return get('/api/subscriptions/features', params);
};

/**
 * Check if a specific feature is available
 * @param {string} featureName - Name of the feature to check
 * @returns {Promise<boolean>} True if the feature is available
 */
export const isFeatureAvailable = async (featureName) => {
  try {
    const response = await get(`/api/subscriptions/features/${featureName}/check`);
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
  return get('/api/subscriptions/status');
};

/**
 * Get subscription upgrade options
 * @returns {Promise<Array>} Available upgrade options
 */
export const getUpgradeOptions = async () => {
  return get('/api/subscriptions/upgrade-options');
};

/**
 * Apply a promo code to subscription
 * @param {string} promoCode - Promo code to apply
 * @returns {Promise<Object>} Promo code application result
 */
export const applyPromoCode = async (promoCode) => {
  return post('/api/subscriptions/apply-promo', { promoCode });
};
