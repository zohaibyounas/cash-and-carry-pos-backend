const mongoose = require('mongoose');

const customerTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['sale', 'payment', 'adjustment'],
        required: true
    },
    amount: { type: Number, required: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    description: String,
    date: { type: Date, default: Date.now }
});

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    address: String,
    kataAccountId: String, // For Kata system integration
    isKataCustomer: { type: Boolean, default: false },
    balance: { type: Number, default: 0 }, // Positive = customer owes us (debit), Negative = we owe customer (credit)
    creditLimit: { type: Number, default: 0 },
    transactions: [customerTransactionSchema],
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    notes: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for fast store lookup
customerSchema.index({ store: 1 });

module.exports = mongoose.model('Customer', customerSchema);
