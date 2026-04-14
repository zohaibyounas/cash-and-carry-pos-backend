const express = require('express');
const router = express.Router();
const { getInventoryByProduct, getInventoryByWarehouse, updateStock } = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const Inventory = require('../models/Inventory');

router.route('/')
    .post(protect, updateStock);

router.route('/product/:productId')
    .get(protect, getInventoryByProduct);

router.route('/warehouse/:warehouseId')
    .get(protect, getInventoryByWarehouse);

// Delete inventory entry (remove product from warehouse)
router.delete('/:id', protect, async (req, res) => {
    try {
        const inventory = await Inventory.findById(req.params.id);
        
        if (!inventory) {
            return res.status(404).json({ message: 'Inventory entry not found' });
        }

        await inventory.deleteOne();
        
        // Sync product totalStock after deletion
        const { syncProductTotalStock } = require('../controllers/inventoryController');
        await syncProductTotalStock(inventory.product);
        
        res.json({ message: 'Product removed from warehouse successfully' });
    } catch (error) {
        console.error('Error deleting inventory:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
