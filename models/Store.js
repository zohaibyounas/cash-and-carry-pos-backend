const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String },
    contactNumber: { type: String },
    printerEnabled: { type: Boolean, default: false },
    printerEndpoint: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Store', storeSchema);
