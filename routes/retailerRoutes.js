const express = require('express');
const router = express.Router();
const {
    createRetailer,
    getRetailers,
    getRetailerById,
    updateRetailer,
    deleteRetailer,
    updateRetailerBalance,
    addPayment
} = require('../controllers/retailerController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getRetailers)
    .post(protect, createRetailer);

router.route('/:id')
    .get(protect, getRetailerById)
    .put(protect, admin, updateRetailer)
    .delete(protect, admin, deleteRetailer);

router.route('/:id/update-balance')
    .post(protect, updateRetailerBalance);

router.route('/:id/payment')
    .post(protect, addPayment);

module.exports = router;
