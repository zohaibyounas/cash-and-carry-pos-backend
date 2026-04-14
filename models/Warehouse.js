const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String },
    contactPerson: { type: String },
    phone: { type: String },
    printerEnabled: { type: Boolean, default: false },
    printerEndpoint: { type: String },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' } // Optional - warehouses are shared across all stores
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);
