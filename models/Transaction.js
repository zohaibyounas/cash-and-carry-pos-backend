const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['CashIn', 'CashOut', 'BankTransfer'],
        required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
