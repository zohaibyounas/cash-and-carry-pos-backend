const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
    name: { type: String, required: true },
    customerName: { type: String },
    code: { type: String },
    accountNo: { type: String, required: true },
    contactNo: { type: String },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Bank', bankSchema);
