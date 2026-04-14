const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    salary: { type: Number, required: true },
    phone: { type: String, required: true },
    address: String,
    CNIC: { type: String, required: true, unique: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    isActive: { type: Boolean, default: true },
    notes: String
}, { timestamps: true });

// Index for fast store lookup
employeeSchema.index({ store: 1 });
employeeSchema.index({ CNIC: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
