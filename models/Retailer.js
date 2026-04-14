const mongoose = require('mongoose');

const retailerTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['sale', 'purchase', 'payment', 'adjustment'],
        required: true
    },
    amount: { type: Number, required: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    description: String,
    date: { type: Date, default: Date.now }
});

const retailerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contact: { type: String, required: true },
    address: String,
    bankAccount: String,
    bankName: String,
    initialPay: { type: Number, default: 0 },
    balance: { type: Number, default: 0 }, // Positive = retailer owes us (debit), Negative = we owe retailer (credit)
    paidAmount: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    purchasedItems: [{ 
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        purchaseDate: Date,
        purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' }
    }],
    transactions: [retailerTransactionSchema],
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    notes: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for fast store lookup
retailerSchema.index({ store: 1 });

module.exports = mongoose.model('Retailer', retailerSchema);
