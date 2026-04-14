const express = require('express');
const router = express.Router();
const { getWarehouses, getWarehouseById, createWarehouse, updateWarehouse, deleteWarehouse } = require('../controllers/warehouseController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getWarehouses)
    .post(protect, admin, createWarehouse);

router.route('/:id')
    .get(protect, getWarehouseById)
    .put(protect, admin, updateWarehouse)
    .delete(protect, admin, deleteWarehouse);

module.exports = router;
