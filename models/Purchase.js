const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    unitType: { type: String, enum: ['box', 'piece'], default: 'box' } // New field
});

const purchaseSchema = new mongoose.Schema({
    vendorName: { type: String, required: true },
    billImage: { type: String },
    items: [purchaseItemSchema],
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, required: true },
    balance: { type: Number, required: true }, // Remaining balance (credit)
    paymentHistory: [{
        amount: Number,
        date: { type: Date, default: Date.now }
    }],
    date: { type: Date, default: Date.now },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
