const express = require('express');
const router = express.Router();
const {
    checkIn,
    checkOut,
    getAttendance,
    getAttendanceReport,
    updateAttendance
} = require('../controllers/attendanceController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/checkin', protect, checkIn);
router.post('/checkout', protect, checkOut);
router.get('/report', protect, getAttendanceReport);
router.get('/', protect, getAttendance);
router.put('/:id', protect, admin, updateAttendance);

module.exports = router;
