const express = require('express');
const router = express.Router();
const { createSale, getSales, deleteSale, convertQuoteToInvoice, updateSale } = require('../controllers/saleController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getSales)
    .post(protect, createSale);

router.route('/:id')
    .put(protect, admin, updateSale)
    .delete(protect, admin, deleteSale);

router.route('/:id/convert')
    .put(protect, convertQuoteToInvoice);

module.exports = router;
