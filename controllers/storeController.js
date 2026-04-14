const Store = require('../models/Store');

// @desc    Get all stores
// @route   GET /api/stores
// @access  Private/Admin
const getStores = async (req, res) => {
    try {
        const stores = await Store.find();
        res.json(stores);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const createStore = async (req, res) => {
    const { name, location, contactNumber, printerEnabled, printerEndpoint } = req.body;
    try {
        const store = new Store({
            name,
            location,
            contactNumber,
            printerEnabled,
            printerEndpoint
        });
        const createdStore = await store.save();
        res.status(201).json(createdStore);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update a store
// @route   PUT /api/stores/:id
// @access  Private/Admin
const updateStore = async (req, res) => {
    const { name, location, contactNumber, printerEnabled, printerEndpoint } = req.body;
    try {
        const store = await Store.findById(req.params.id);
        if (store) {
            store.name = name || store.name;
            store.location = location || store.location;
            store.contactNumber = contactNumber || store.contactNumber;
            store.printerEnabled = printerEnabled !== undefined ? printerEnabled : store.printerEnabled;
            store.printerEndpoint = printerEndpoint !== undefined ? printerEndpoint : store.printerEndpoint;

            const updatedStore = await store.save();
            res.json(updatedStore);
        } else {
            res.status(404).json({ message: 'Store not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getStores, createStore, updateStore };
