const express = require('express');
const router = express.Router();
const { getBanks, createBank, updateBank, deleteBank } = require('../controllers/bankController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getBanks)
    .post(protect, createBank);

router.route('/:id')
    .put(protect, updateBank)
    .delete(protect, deleteBank);

module.exports = router;
