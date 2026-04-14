const Bank = require('../models/Bank');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Get all banks
// @route   GET /api/banks
const getBanks = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const banks = await Bank.find({ store: storeId });
        res.json(banks);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a bank
// @route   POST /api/banks
const createBank = async (req, res) => {
    const { name, customerName, code, accountNo, contactNo } = req.body;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const bank = new Bank({ name, customerName, code, accountNo, contactNo, store: storeId });
        const createdBank = await bank.save();
        res.status(201).json(createdBank);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update bank
const updateBank = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        const bank = await Bank.findOne({ _id: req.params.id, store: storeId });

        if (bank) {
            bank.name = req.body.name || bank.name;
            bank.customerName = req.body.customerName !== undefined ? req.body.customerName : bank.customerName;
            bank.code = req.body.code || bank.code;
            bank.accountNo = req.body.accountNo || bank.accountNo;
            bank.contactNo = req.body.contactNo || bank.contactNo;

            const updatedBank = await bank.save();
            res.json(updatedBank);
        } else {
            res.status(404).json({ message: 'Bank not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete bank
const deleteBank = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        const result = await Bank.deleteOne({ _id: req.params.id, store: storeId });
        if (result.deletedCount > 0) {
            res.json({ message: 'Bank removed' });
        } else {
            res.status(404).json({ message: 'Bank not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getBanks, createBank, updateBank, deleteBank };
