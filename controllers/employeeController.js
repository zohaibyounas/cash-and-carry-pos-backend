const Employee = require('../models/Employee');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Create new employee
// @route   POST /api/employees
const createEmployee = async (req, res) => {
    const { name, joiningDate, salary, phone, address, CNIC, notes } = req.body;

    try {
        const storeId = getActiveStore(req);
        
        // Check if employee with CNIC already exists
        const existingEmployee = await Employee.findOne({ CNIC });
        if (existingEmployee) {
            return res.status(400).json({ message: 'Employee with this CNIC already exists' });
        }

        const employee = new Employee({
            name,
            joiningDate: new Date(joiningDate),
            salary,
            phone,
            address,
            CNIC,
            store: storeId,
            notes
        });

        const createdEmployee = await employee.save();
        res.status(201).json(createdEmployee);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all employees
// @route   GET /api/employees
const getEmployees = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        let query = {};
        
        if (storeId) {
            query.store = storeId;
        }

        const employees = await Employee.find(query)
            .populate('store', 'name')
            .sort({ createdAt: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get employee by ID
// @route   GET /api/employees/:id
const getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id)
            .populate('store', 'name');
        
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
const updateEmployee = async (req, res) => {
    try {
        const { name, joiningDate, salary, phone, address, CNIC, notes, isActive } = req.body;
        
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Check CNIC uniqueness if changed
        if (CNIC && CNIC !== employee.CNIC) {
            const existingEmployee = await Employee.findOne({ CNIC });
            if (existingEmployee) {
                return res.status(400).json({ message: 'Employee with this CNIC already exists' });
            }
        }

        employee.name = name || employee.name;
        employee.joiningDate = joiningDate ? new Date(joiningDate) : employee.joiningDate;
        employee.salary = salary !== undefined ? salary : employee.salary;
        employee.phone = phone || employee.phone;
        employee.address = address !== undefined ? address : employee.address;
        employee.CNIC = CNIC || employee.CNIC;
        employee.notes = notes !== undefined ? notes : employee.notes;
        employee.isActive = isActive !== undefined ? isActive : employee.isActive;

        const updatedEmployee = await employee.save();
        res.json(updatedEmployee);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        await employee.deleteOne();
        res.json({ message: 'Employee removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
};
