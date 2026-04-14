const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Check-in employee
// @route   POST /api/attendance/checkin
const checkIn = async (req, res) => {
    try {
        const { employeeId } = req.body;
        const storeId = getActiveStore(req);
        
        if (!employeeId) {
            return res.status(400).json({ message: 'Employee ID is required' });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if attendance already exists for today
        let attendance = await Attendance.findOne({
            employee: employeeId,
            date: today
        });

        if (attendance && attendance.checkIn) {
            return res.status(400).json({ message: 'Employee already checked in today' });
        }

        if (attendance) {
            attendance.checkIn = new Date();
            attendance.status = 'present';
        } else {
            attendance = new Attendance({
                employee: employeeId,
                date: today,
                checkIn: new Date(),
                status: 'present',
                store: storeId || employee.store
            });
        }

        await attendance.save();
        const populated = await Attendance.findById(attendance._id)
            .populate('employee', 'name phone CNIC');

        res.json(populated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Check-out employee
// @route   POST /api/attendance/checkout
const checkOut = async (req, res) => {
    try {
        const { employeeId } = req.body;
        
        if (!employeeId) {
            return res.status(400).json({ message: 'Employee ID is required' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({
            employee: employeeId,
            date: today
        });

        if (!attendance || !attendance.checkIn) {
            return res.status(400).json({ message: 'Employee has not checked in today' });
        }

        if (attendance.checkOut) {
            return res.status(400).json({ message: 'Employee already checked out today' });
        }

        attendance.checkOut = new Date();
        
        // Calculate total hours
        const checkInTime = new Date(attendance.checkIn).getTime();
        const checkOutTime = new Date(attendance.checkOut).getTime();
        const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        attendance.totalHours = Math.round(hoursWorked * 100) / 100;

        await attendance.save();
        const populated = await Attendance.findById(attendance._id)
            .populate('employee', 'name phone CNIC');

        res.json(populated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attendance records
// @route   GET /api/attendance
const getAttendance = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        const { startDate, endDate, employeeId } = req.query;
        
        let query = {};
        if (storeId) query.store = storeId;
        if (employeeId) query.employee = employeeId;

        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendance = await Attendance.find(query)
            .populate('employee', 'name phone CNIC salary')
            .populate('store', 'name')
            .sort({ date: -1, createdAt: -1 });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attendance report
// @route   GET /api/attendance/report
const getAttendanceReport = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        const { startDate, endDate } = req.query;
        
        let dateQuery = {};
        if (startDate && endDate) {
            dateQuery = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        let storeQuery = {};
        if (storeId) storeQuery.store = storeId;

        const attendance = await Attendance.find({ ...dateQuery, ...storeQuery })
            .populate('employee', 'name phone CNIC salary')
            .populate('store', 'name')
            .sort({ date: -1 });

        // Calculate statistics
        const totalRecords = attendance.length;
        const presentCount = attendance.filter(a => a.status === 'present' && a.checkIn).length;
        const absentCount = attendance.filter(a => a.status === 'absent').length;
        const lateCount = attendance.filter(a => a.status === 'late').length;
        const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);

        // Group by employee
        const employeeStats = {};
        attendance.forEach(a => {
            const empId = a.employee._id.toString();
            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    employee: a.employee,
                    presentDays: 0,
                    absentDays: 0,
                    lateDays: 0,
                    totalHours: 0
                };
            }
            if (a.status === 'present' && a.checkIn) employeeStats[empId].presentDays++;
            if (a.status === 'absent') employeeStats[empId].absentDays++;
            if (a.status === 'late') employeeStats[empId].lateDays++;
            employeeStats[empId].totalHours += a.totalHours || 0;
        });

        res.json({
            summary: {
                totalRecords,
                presentCount,
                absentCount,
                lateCount,
                totalHours: Math.round(totalHours * 100) / 100
            },
            employeeStats: Object.values(employeeStats),
            records: attendance
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update attendance manually
// @route   PUT /api/attendance/:id
const updateAttendance = async (req, res) => {
    try {
        const { checkIn, checkOut, status, notes } = req.body;
        
        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        if (checkIn) attendance.checkIn = new Date(checkIn);
        if (checkOut) {
            attendance.checkOut = new Date(checkOut);
            // Recalculate hours if both check-in and check-out exist
            if (attendance.checkIn) {
                const checkInTime = new Date(attendance.checkIn).getTime();
                const checkOutTime = new Date(attendance.checkOut).getTime();
                const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
                attendance.totalHours = Math.round(hoursWorked * 100) / 100;
            }
        }
        if (status) attendance.status = status;
        if (notes !== undefined) attendance.notes = notes;

        await attendance.save();
        const populated = await Attendance.findById(attendance._id)
            .populate('employee', 'name phone CNIC')
            .populate('store', 'name');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    checkIn,
    checkOut,
    getAttendance,
    getAttendanceReport,
    updateAttendance
};
