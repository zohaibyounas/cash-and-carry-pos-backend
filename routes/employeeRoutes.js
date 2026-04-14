const express = require('express');
const router = express.Router();
const {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
} = require('../controllers/employeeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getEmployees)
    .post(protect, admin, createEmployee);

router.route('/:id')
    .get(protect, getEmployeeById)
    .put(protect, admin, updateEmployee)
    .delete(protect, admin, deleteEmployee);

module.exports = router;
