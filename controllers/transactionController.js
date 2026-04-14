const Transaction = require('../models/Transaction');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Get all transactions
// @route   GET /api/transactions
const getTransactions = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const { startDate, endDate, type } = req.query;
        let query = { store: storeId };

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (type) {
            query.type = type;
        }

        const transactions = await Transaction.find(query)
            .populate('bank', 'name accountNo')
            .sort({ date: -1 });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a transaction
// @route   POST /api/transactions
const createTransaction = async (req, res) => {
    const { type, amount, date, description, bank } = req.body;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount)) {
            return res.status(400).json({ message: 'Amount must be a valid number' });
        }
        if (parsedAmount < 50) {
            return res.status(400).json({ message: 'Minimum transaction amount is 50' });
        }

        const transaction = new Transaction({
            type,
            amount: parsedAmount,
            date,
            description,
            bank,
            store: storeId
        });

        const createdTransaction = await transaction.save();
        res.status(201).json(createdTransaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getTransactions, createTransaction };
