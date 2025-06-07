const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); // Assuming controller functions will be in adminController
const { isAuthenticated, isAdmin } = require('../middleware/auth'); // Assuming auth middleware

// Protect all routes in this file with isAuthenticated and isAdmin
router.use(isAuthenticated);
router.use(isAdmin);

// Routes for global payment method types
router.get('/types', adminController.listGlobalPaymentMethodTypes);
router.post('/types', adminController.createGlobalPaymentMethodType);

// Routes for country-specific payment method configurations
router.get('/country/:countryId', adminController.listCountryPaymentMethods);
router.post('/country/:countryId', adminController.configureCountryPaymentMethod); // For adding/updating a method in a country

router.get('/country/:countryId/method/:paymentMethodId', adminController.getCountryPaymentMethodDetail);
router.put('/country/:countryId/method/:paymentMethodId', adminController.updateCountryPaymentMethodConfiguration);
router.delete('/country/:countryId/method/:paymentMethodId', adminController.removeCountryPaymentMethod);

module.exports = router;
