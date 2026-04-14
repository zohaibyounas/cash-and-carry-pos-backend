const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    date: { type: Date, default: Date.now },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
