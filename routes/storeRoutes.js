const express = require('express');
const router = express.Router();
const { getStores, createStore, updateStore } = require('../controllers/storeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getStores)
    .post(protect, admin, createStore);

router.route('/:id')
    .put(protect, admin, updateStore);

module.exports = router;
