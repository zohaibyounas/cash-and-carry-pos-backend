const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { syncProductTotalStock } = require('./inventoryController');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Get all purchases
// @route   GET /api/purchases
const getPurchases = async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const storeId = getActiveStore(req);
    if (!storeId) return res.status(400).json({ message: 'Store context required' });

    let dateFilter = { store: storeId };
    if (startDate && endDate) {
        dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    try {
        const purchases = await Purchase.find(dateFilter).sort({ createdAt: -1 });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add payment to existing purchase
// @route   POST /api/purchases/:id/payments
const addPurchasePayment = async (req, res) => {
    const { amount } = req.body;
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (purchase) {
            purchase.paidAmount += Number(amount);
            purchase.balance -= Number(amount);
            purchase.paymentHistory.push({ amount: Number(amount), date: new Date() });

            const updatedPurchase = await purchase.save();
            res.json(updatedPurchase);
        } else {
            res.status(404).json({ message: 'Purchase not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a purchase
// @route   POST /api/purchases
const createPurchase = async (req, res) => {
    const {
        vendorName, items, totalAmount,
        paidAmount, balance
    } = req.body;

    try {
        const purchase = new Purchase({
            vendorName,
            items: items ? JSON.parse(items) : [],
            totalAmount,
            paidAmount,
            balance,
            billImage: req.file ? `/uploads/${req.file.filename}` : ''
        });

        const createdPurchase = await purchase.save();

        // Update Stock for each item and add to inventory
        if (items) {
            const parsedItems = JSON.parse(items);
            for (const item of parsedItems) {
                const product = await Product.findById(item.product);
                if (product) {
                    // Update cost price based on unitType
                    const unitType = item.unitType || 'box';
                    if (unitType === 'piece') {
                        product.pieceCostPrice = Number(item.costPrice);
                    } else {
                        product.costPrice = Number(item.costPrice);
                    }
                    await product.save();
                    
                    // Determine actual quantity in pieces to add
                    let qtyToAdd = Number(item.quantity);
                    if (unitType === 'box' && product.hasPieces) {
                        qtyToAdd = Number(item.quantity) * (product.piecesPerBox || 1);
                    }

                    // ADD STOCK DIRECTLY
                    product.totalStock = (product.totalStock || 0) + qtyToAdd;
                    await product.save();
                    
                    const warehouseId = item.warehouse || item.warehouseId;
                    if (warehouseId) {
                        const inventory = await Inventory.findOne({ 
                            product: item.product,
                            warehouse: warehouseId
                        });
                        
                        if (inventory) {
                            inventory.quantity += qtyToAdd;
                            await inventory.save();
                        } else {
                            await Inventory.create({
                                product: item.product,
                                warehouse: warehouseId,
                                quantity: qtyToAdd
                            });
                        }
                        
                        // Sync product totalStock from all warehouse inventories
                        await syncProductTotalStock(item.product);
                    }
                }
            }
        }

        res.status(201).json(createdPurchase);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a purchase
// @route   PUT /api/purchases/:id
const updatePurchase = async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (purchase) {
            purchase.vendorName = req.body.vendorName || purchase.vendorName;
            purchase.totalAmount = req.body.totalAmount || purchase.totalAmount;
            purchase.paidAmount = req.body.paidAmount || purchase.paidAmount;
            purchase.balance = req.body.balance || purchase.balance;

            if (req.file) {
                purchase.billImage = `/uploads/${req.file.filename}`;
            }

            const updatedPurchase = await purchase.save();
            res.json(updatedPurchase);
        } else {
            res.status(404).json({ message: 'Purchase not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a purchase
// @route   DELETE /api/purchases/:id
const deletePurchase = async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (purchase) {
            await purchase.deleteOne();
            res.json({ message: 'Purchase removed' });
        } else {
            res.status(404).json({ message: 'Purchase not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getPurchases, createPurchase, updatePurchase, deletePurchase, addPurchasePayment };
