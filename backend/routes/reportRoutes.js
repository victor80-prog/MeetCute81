const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// Get all reports or reports by type
router.get('/', isAuthenticated, isAdmin, reportController.getReportedContent);

// Get report details
router.get('/:id', isAuthenticated, isAdmin, reportController.getReportDetails);

// Update report status
router.put('/:id/status', isAuthenticated, isAdmin, reportController.updateReportStatus);

module.exports = router; 