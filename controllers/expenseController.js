const Expense = require('../models/Expense');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Get all expenses
// @route   GET /api/expenses
const getExpenses = async (req, res) => {
    const { startDate, endDate } = req.query;
    const storeId = getActiveStore(req);

    if (!storeId) return res.status(400).json({ message: 'Store context required' });

    let dateFilter = { store: storeId };
    if (startDate && endDate) {
        dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    try {
        const expenses = await Expense.find(dateFilter).populate('store', 'name').sort({ createdAt: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create an expense
// @route   POST /api/expenses
const createExpense = async (req, res) => {
    const { title, amount, category, description } = req.body;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const expense = new Expense({ title, amount, category, description, store: storeId });
        const createdExpense = await expense.save();
        res.status(201).json(createdExpense);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
const updateExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (expense) {
            expense.title = req.body.title || expense.title;
            expense.amount = req.body.amount || expense.amount;
            expense.category = req.body.category || expense.category;
            expense.description = req.body.description || expense.description;
            const updatedExpense = await expense.save();
            res.json(updatedExpense);
        } else {
            res.status(404).json({ message: 'Expense not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (expense) {
            await expense.deleteOne();
            res.json({ message: 'Expense removed' });
        } else {
            res.status(404).json({ message: 'Expense not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense };
