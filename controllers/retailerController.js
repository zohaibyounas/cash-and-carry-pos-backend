const Retailer = require('../models/Retailer');
const Purchase = require('../models/Purchase');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Create new retailer
// @route   POST /api/retailers
const createRetailer = async (req, res) => {
    const { name, contact, address, bankAccount, bankName, initialPay, notes } = req.body;

    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const retailer = new Retailer({
            name,
            contact,
            address,
            bankAccount,
            bankName,
            initialPay: initialPay || 0,
            store: storeId,
            notes
        });

        // If initial pay is provided, add it as a payment transaction
        if (initialPay && initialPay > 0) {
            retailer.transactions.push({
                type: 'payment',
                amount: initialPay,
                description: 'Initial payment',
                date: new Date()
            });
            retailer.paidAmount = initialPay;
            retailer.balance = -initialPay; // Negative because they paid us
            retailer.remainingBalance = -initialPay;
        }

        const createdRetailer = await retailer.save();
        res.status(201).json(createdRetailer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all retailers
// @route   GET /api/retailers
const getRetailers = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const retailers = await Retailer.find({ store: storeId })
            .populate('store', 'name')
            .populate('purchasedItems.product', 'name barcode')
            .populate('purchasedItems.purchase')
            .populate('transactions.purchase')
            .populate('transactions.sale', 'invoiceId totalAmount paidAmount saleDate')
            .sort({ createdAt: -1 });
        
        // Calculate totals from transactions
        const retailersWithTotals = retailers.map(retailer => {
            const retailerObj = retailer.toObject();
            
            const totalSales = (retailerObj.transactions || [])
                .filter(t => t.type === 'sale')
                .reduce((sum, t) => sum + Number(t.amount || 0), 0);
            
            const totalPurchases = (retailerObj.transactions || [])
                .filter(t => t.type === 'purchase')
                .reduce((sum, t) => sum + Number(t.amount || 0), 0);
            
            const totalPaid = (retailerObj.transactions || [])
                .filter(t => t.type === 'payment')
                .reduce((sum, t) => sum + Number(t.amount || 0), 0);
            
            const totalDebit = totalSales + totalPurchases;
            const remainingBalance = totalDebit - totalPaid;
            
            return {
                ...retailerObj,
                totalSales,
                totalPurchases,
                totalDebit,
                totalPaid,
                remainingBalance
            };
        });
        
        res.json(retailersWithTotals);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get retailer by ID
// @route   GET /api/retailers/:id
const getRetailerById = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.params.id)
            .populate('store', 'name')
            .populate('purchasedItems.product', 'name barcode')
            .populate('purchasedItems.purchase')
            .populate('transactions.purchase')
            .populate({
                path: 'transactions.sale',
                populate: {
                    path: 'items.product',
                    select: 'name barcode'
                }
            });
        
        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }
        
        // Calculate totals from transactions
        const retailerObj = retailer.toObject();
        
        const totalSales = (retailerObj.transactions || [])
            .filter(t => t.type === 'sale')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalPurchases = (retailerObj.transactions || [])
            .filter(t => t.type === 'purchase')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalPaid = (retailerObj.transactions || [])
            .filter(t => t.type === 'payment')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalDebit = totalSales + totalPurchases;
        const remainingBalance = totalDebit - totalPaid;
        
        const retailerWithTotals = {
            ...retailerObj,
            totalSales,
            totalPurchases,
            totalDebit,
            totalPaid,
            remainingBalance
        };
        
        res.json(retailerWithTotals);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update retailer
// @route   PUT /api/retailers/:id
const updateRetailer = async (req, res) => {
    try {
        const { name, contact, address, bankAccount, bankName, initialPay, notes } = req.body;
        
        const retailer = await Retailer.findById(req.params.id);
        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        retailer.name = name || retailer.name;
        retailer.contact = contact || retailer.contact;
        retailer.address = address !== undefined ? address : retailer.address;
        retailer.bankAccount = bankAccount !== undefined ? bankAccount : retailer.bankAccount;
        retailer.bankName = bankName !== undefined ? bankName : retailer.bankName;
        retailer.notes = notes !== undefined ? notes : retailer.notes;

        const updatedRetailer = await retailer.save();
        res.json(updatedRetailer);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete retailer
// @route   DELETE /api/retailers/:id
const deleteRetailer = async (req, res) => {
    try {
        const retailer = await Retailer.findById(req.params.id);
        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        await retailer.deleteOne();
        res.json({ message: 'Retailer removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update retailer balance from purchase
// @route   POST /api/retailers/:id/update-balance
const updateRetailerBalance = async (req, res) => {
    try {
        const { purchaseId, amount, type, description } = req.body;
        const retailer = await Retailer.findById(req.params.id);
        
        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        // Update balance
        if (type === 'purchase') {
            retailer.balance += amount;
        } else if (type === 'payment') {
            retailer.balance -= amount;
            retailer.paidAmount += amount;
        }

        retailer.remainingBalance = retailer.balance;
        
        // Add transaction
        retailer.transactions.push({
            type,
            amount,
            purchase: purchaseId,
            description: description || `${type === 'purchase' ? 'Purchase' : 'Payment'} of Rs. ${amount}`,
            date: new Date()
        });

        await retailer.save();
        const populated = await Retailer.findById(retailer._id)
            .populate('transactions.purchase');
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add payment for retailer
// @route   POST /api/retailers/:id/payment
const addPayment = async (req, res) => {
    try {
        const { amount, description, saleId } = req.body;
        const Sale = require('../models/Sale');
        const retailer = await Retailer.findById(req.params.id);
        
        if (!retailer) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        const paymentAmount = Number(amount);

        // Add payment transaction
        const paymentTransaction = {
            type: 'payment',
            amount: paymentAmount,
            description: description || `Payment of Rs. ${amount}`,
            date: new Date()
        };
        
        // Link payment to sale if saleId is provided
        if (saleId) {
            paymentTransaction.sale = saleId;
        }
        
        retailer.transactions.push(paymentTransaction);

        // Save first to ensure transaction is persisted
        await retailer.save();

        // Reload retailer to get fresh data
        const reloadedRetailer = await Retailer.findById(retailer._id);
        const retailerObj = reloadedRetailer.toObject();
        
        // Recalculate balance from all transactions
        const totalSales = (retailerObj.transactions || [])
            .filter(t => t.type === 'sale')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalPurchases = (retailerObj.transactions || [])
            .filter(t => t.type === 'purchase')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalPaid = (retailerObj.transactions || [])
            .filter(t => t.type === 'payment')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const totalDebit = totalSales + totalPurchases;
        const remainingBalance = totalDebit - totalPaid;

        console.log(`Retailer ${retailer.name}: Sales=${totalSales}, Purchases=${totalPurchases}, Paid=${totalPaid}, Remaining=${remainingBalance}`);

        // Update balances based on calculated values
        reloadedRetailer.balance = remainingBalance;
        reloadedRetailer.paidAmount = totalPaid;
        reloadedRetailer.remainingBalance = remainingBalance;

        await reloadedRetailer.save();

        // Update sale payment status if saleId is provided
        if (saleId) {
            const sale = await Sale.findById(saleId);
            if (sale) {
                // Calculate total paid for this sale from all retailer payment transactions
                const salePayments = (retailerObj.transactions || [])
                    .filter(t => t.type === 'payment' && t.sale && t.sale.toString() === saleId.toString())
                    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                
                sale.paidAmount = salePayments;
                
                // Update payment status
                if (sale.paidAmount >= sale.totalAmount) {
                    sale.paymentStatus = 'paid';
                } else if (sale.paidAmount > 0) {
                    sale.paymentStatus = 'partial';
                } else {
                    sale.paymentStatus = 'unpaid';
                }
                
                console.log(`Updated sale ${sale.invoiceId}: Total=${sale.totalAmount}, Paid=${sale.paidAmount}, Status=${sale.paymentStatus}`);
                
                await sale.save();
            }
        }

        const populated = await Retailer.findById(reloadedRetailer._id)
            .populate('transactions.purchase')
            .populate('transactions.sale', 'invoiceId totalAmount paidAmount saleDate paymentStatus')
            .populate('store', 'name');
        
        // Use the already calculated values
        const retailerWithTotals = {
            ...populated.toObject(),
            totalSales,
            totalPurchases,
            totalDebit,
            totalPaid,
            remainingBalance
        };
        
        res.json(retailerWithTotals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createRetailer,
    getRetailers,
    getRetailerById,
    updateRetailer,
    deleteRetailer,
    updateRetailerBalance,
    addPayment
};
