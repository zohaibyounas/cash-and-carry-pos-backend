const express = require('express');
const router = express.Router();
const { getPurchases, createPurchase, updatePurchase, deletePurchase, addPurchasePayment } = require('../controllers/purchaseController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/')
    .get(protect, getPurchases)
    .post(protect, admin, upload.single('billImage'), createPurchase);

router.route('/:id')
    .put(protect, admin, upload.single('billImage'), updatePurchase)
    .delete(protect, admin, deletePurchase);

router.route('/:id/payments')
    .post(protect, admin, addPurchasePayment);

module.exports = router;
