const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    unitType: { type: String, enum: ['box', 'piece'], default: 'box' }, // New field
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
});

const saleSchema = new mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    salesman: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [saleItemSchema],
    subtotal: { type: Number, required: true },
    invoiceDiscount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
        type: String,
        enum: ['paid', 'partial', 'unpaid'],
        default: 'paid'
    },
    type: {
        type: String,
        enum: ['invoice', 'quotation', 'estimate'],
        default: 'invoice'
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer' }, // Link to retailer for wholesale sales
    customerName: String,
    customerPhone: String,
    customerAddress: String,
    referenceNo: String,
    remarks: String,
    dueDate: Date,
    saleDate: { type: Date, default: Date.now }, // Custom sale date/time
    invoiceId: { type: String, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
