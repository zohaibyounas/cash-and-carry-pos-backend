const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

// Helper function to sync product totalStock from all warehouse inventories
const syncProductTotalStock = async (productId) => {
    try {
        const inventories = await Inventory.find({ product: productId });
        const totalStock = inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
        await Product.findByIdAndUpdate(productId, { totalStock });
        return totalStock;
    } catch (error) {
        console.error('Error syncing product total stock:', error);
        return null;
    }
};

// @desc    Get inventory by product
// @route   GET /api/inventory/product/:productId
const getInventoryByProduct = async (req, res) => {
    try {
        const inventory = await Inventory.find({ product: req.params.productId })
            .populate('warehouse', 'name location');
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get inventory by warehouse
// @route   GET /api/inventory/warehouse/:warehouseId
const getInventoryByWarehouse = async (req, res) => {
    try {
        const inventory = await Inventory.find({ warehouse: req.params.warehouseId })
            .populate('product', 'name barcode salePrice costPrice image')
            .sort({ 'product.name': 1 });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update stock in warehouse
// @route   POST /api/inventory
const updateStock = async (req, res) => {
    const { productId, warehouseId, quantity } = req.body;
    try {
        let inventory = await Inventory.findOne({ product: productId, warehouse: warehouseId });
        if (inventory) {
            inventory.quantity += Number(quantity);
            await inventory.save();
        } else {
            inventory = await Inventory.create({
                product: productId,
                warehouse: warehouseId,
                quantity: Number(quantity)
            });
        }
        
        // Sync product totalStock from all warehouse inventories
        await syncProductTotalStock(productId);
        
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getInventoryByProduct, getInventoryByWarehouse, updateStock, syncProductTotalStock };
