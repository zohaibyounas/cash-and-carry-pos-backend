const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getSalesReport,
    getTopSelling,
    getStockReport,
    getPnLReport,
    getInventoryInvoices,
    getFinancialReport
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, getDashboardStats);
router.get('/sales-report', protect, getSalesReport);
router.get('/top-selling', protect, getTopSelling);
router.get('/stock-report', protect, getStockReport);
router.get('/pnl-report', protect, getPnLReport);
router.get('/inventory-invoices', protect, getInventoryInvoices);
router.get('/financial-report', protect, getFinancialReport);

module.exports = router;
