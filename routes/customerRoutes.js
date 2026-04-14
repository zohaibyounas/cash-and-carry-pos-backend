const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    getCustomerByPhone,
    getCustomerById,
    updateCustomerBalance,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createCustomer)
    .get(protect, getCustomers);

router.route('/phone/:phone')
    .get(protect, getCustomerByPhone);

router.route('/:id')
    .get(protect, getCustomerById)
    .put(protect, updateCustomer)
    .delete(protect, deleteCustomer);

router.route('/:id/balance')
    .put(protect, updateCustomerBalance);

module.exports = router;
