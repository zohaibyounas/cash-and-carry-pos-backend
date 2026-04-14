const Customer = require('../models/Customer');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Create new customer
// @route   POST /api/customers
const createCustomer = async (req, res) => {
    const { name, phone, address, kataAccountId, creditLimit, store, notes } = req.body;

    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        // Check if customer with phone already exists IN THIS STORE
        const existingCustomer = await Customer.findOne({ phone, store: storeId });
        if (existingCustomer) {
            return res.status(400).json({ message: 'Customer with this phone number already exists in this store' });
        }

        const customer = new Customer({
            name,
            phone,
            address,
            kataAccountId,
            isKataCustomer: !!kataAccountId,
            creditLimit: creditLimit || 0,
            store: storeId, // Force store ID
            notes
        });

        const createdCustomer = await customer.save();
        res.status(201).json(createdCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all customers
// @route   GET /api/customers
const getCustomers = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const customers = await Customer.find({ store: storeId })
            .populate('store', 'name')
            .sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get customer by phone
// @route   GET /api/customers/phone/:phone
// @query   storeId (optional, mostly handled by auth/header)
const getCustomerByPhone = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const customer = await Customer.findOne({ phone: req.params.phone, store: storeId })
            .populate('store', 'name');

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get customer by ID
// @route   GET /api/customers/:id
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id)
            .populate('store', 'name')
            .populate('transactions.sale');

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update customer balance
// @route   PUT /api/customers/:id/balance
const updateCustomerBalance = async (req, res) => {
    const { amount, type, description, saleId } = req.body;

    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Update balance
        if (type === 'sale') {
            customer.balance += amount; // Customer owes more
        } else if (type === 'payment') {
            customer.balance -= amount; // Customer paid
        } else if (type === 'adjustment') {
            customer.balance += amount; // Can be positive or negative
        }

        // Add transaction record
        customer.transactions.push({
            type,
            amount,
            sale: saleId,
            description
        });

        await customer.save();
        res.json(customer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        const { name, phone, address, kataAccountId, creditLimit, notes, isActive } = req.body;

        customer.name = name || customer.name;
        customer.phone = phone || customer.phone;
        customer.address = address !== undefined ? address : customer.address;
        customer.kataAccountId = kataAccountId !== undefined ? kataAccountId : customer.kataAccountId;
        customer.isKataCustomer = !!customer.kataAccountId;
        customer.creditLimit = creditLimit !== undefined ? creditLimit : customer.creditLimit;
        customer.notes = notes !== undefined ? notes : customer.notes;
        customer.isActive = isActive !== undefined ? isActive : customer.isActive;

        const updatedCustomer = await customer.save();
        res.json(updatedCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        // Check if customer has outstanding balance
        if (customer.balance !== 0) {
            return res.status(400).json({ message: 'Cannot delete customer with outstanding balance' });
        }

        await customer.deleteOne();
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createCustomer,
    getCustomers,
    getCustomerByPhone,
    getCustomerById,
    updateCustomerBalance,
    updateCustomer,
    deleteCustomer
};
