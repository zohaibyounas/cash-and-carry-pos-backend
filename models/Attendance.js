const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    totalHours: { type: Number, default: 0 }, // Total hours worked
    status: {
        type: String,
        enum: ['present', 'absent', 'late', 'half-day'],
        default: 'present'
    },
    notes: String,
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' }
}, { timestamps: true });

// Index for fast lookups
attendanceSchema.index({ employee: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ store: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
