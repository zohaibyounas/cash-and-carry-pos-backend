const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');
const Retailer = require('../models/Retailer');
const Store = require('../models/Store');
const Warehouse = require('../models/Warehouse');
const { sendToPrinter, sendWarehouseReceipt } = require('../utils/printerService');
const { syncProductTotalStock } = require('./inventoryController');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};


// @desc    Create new sale / quotation
// @route   POST /api/sales
const createSale = async (req, res) => {
    const {
        store, salesman, items, subtotal,
        invoiceDiscount, totalAmount, paidAmount,
        type = 'invoice', // invoice, quotation, estimate
        customer, // customerId
        retailer, // retailerId
        customerName, customerPhone, customerAddress,
        referenceNo, remarks, dueDate, saleDate
    } = req.body;

    try {
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items in sale' });
        }

        const prefix = type === 'quotation' ? 'QUT-' : (type === 'estimate' ? 'EST-' : 'INV-');
        const invoiceId = `${prefix}${Date.now()}`;

        // Enrich items with current costPrice and check stock
        const enrichedItems = [];
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: `Product ${item.product} not found` });
            }

            // Calculate actual units for stock check
            let unitsToDeduct = Number(item.quantity);
            let itemCostPrice = product.costPrice;

            if (item.unitType === 'piece' && product.hasPieces) {
                itemCostPrice = product.pieceCostPrice;
            } else if (item.unitType === 'box' && product.hasPieces) {
                unitsToDeduct = Number(item.quantity) * (product.piecesPerBox || 1);
            }

            // ONLY check stock for INVOICE type
            if (type === 'invoice' && Number(product.totalStock) < unitsToDeduct) {
                return res.status(400).json({
                    message: `Insufficient stock for product: ${product.name}. Available pieces: ${product.totalStock}, Requested pieces: ${unitsToDeduct}`
                });
            }

            enrichedItems.push({
                product: item.product,
                quantity: item.quantity,
                unitsToDeduct, // Storing for loop below
                costPrice: itemCostPrice,
                price: item.price,
                total: item.total,
                unitType: item.unitType || 'box',
                store: product.store // Ensure store is captured for each item
            });
        }

        const sale = new Sale({
            store,
            salesman,
            items: enrichedItems,
            subtotal,
            invoiceDiscount,
            totalAmount,
            paidAmount: paidAmount || 0,
            invoiceId,
            paymentStatus: (paidAmount || 0) >= totalAmount ? 'paid' : ((paidAmount || 0) > 0 ? 'partial' : 'unpaid'),
            type,
            customer,
            retailer,
            customerName,
            customerPhone,
            customerAddress,
            referenceNo,
            remarks,
            dueDate,
            saleDate: saleDate ? new Date(saleDate) : new Date() // Auto-detect current date/time if not provided
        });

        const createdSale = await sale.save();

        // ONLY Update Stock & Customer Balance if it's an INVOICE
        // Track which warehouse each item belongs to for receipt printing
        // Map: productId -> warehouseId (for this sale)
        const productWarehouseMap = {}; 
        
        if (type === 'invoice') {
            // Update Stock
            for (const item of enrichedItems) {
                console.log('\n=== Processing sale for product:', item.product, 'Quantity:', item.quantity, '===');
                
                // Update product totalStock directly (always works)
                const product = await Product.findById(item.product);
                if (product) {
                    product.totalStock = Number(product.totalStock) - Number(item.unitsToDeduct);
                    await product.save();
                    console.log('Product totalStock updated:', product.totalStock);
                }
                
                // Try to find warehouse inventory
                let inventory = await Inventory.findOne({
                    product: item.product,
                    quantity: { $gt: 0 }
                }).populate('warehouse').sort({ quantity: -1 });
                
                console.log('Found inventory with stock > 0:', inventory ? `Yes (Qty: ${inventory.quantity})` : 'No');

                // If no inventory with stock, find any inventory
                if (!inventory) {
                    console.log('No inventory with stock, searching for any inventory...');
                    inventory = await Inventory.findOne({
                        product: item.product
                    }).populate('warehouse');
                    console.log('Found any inventory:', inventory ? `Yes (Qty: ${inventory.quantity})` : 'No');
                }

                // Update inventory if found, otherwise skip (product sold from general stock)
                if (inventory) {
                    console.log('Updating inventory - Before:', inventory.quantity, 'After:', Number(inventory.quantity) - Number(item.unitsToDeduct));
                    inventory.quantity = Number(inventory.quantity) - Number(item.unitsToDeduct);
                    await inventory.save();
                    console.log('Inventory updated successfully!');
                    productWarehouseMap[item.product.toString()] = inventory.warehouse._id.toString();
                } else {
                    console.log('No inventory found - product sold from general stock (no warehouse tracking)');
                    // Try to get first warehouse for receipt printing
                    const firstWarehouse = await Warehouse.findOne({});
                    if (firstWarehouse) {
                        productWarehouseMap[item.product.toString()] = firstWarehouse._id.toString();
                    }
                }
            }

            // Update Customer Balance if linked
            if (customer) {
                const cust = await Customer.findById(customer);
                if (cust) {
                    // Calculate amount owed (Total - Paid)
                    const amountOwed = totalAmount - paidAmount;

                    // Add transaction for the sale (Debit)
                    cust.balance += totalAmount;
                    cust.transactions.push({
                        type: 'sale',
                        amount: totalAmount,
                        sale: createdSale._id,
                        description: `Invoice ${invoiceId}`
                    });

                    // Add transaction for payment if any (Credit)
                    if (paidAmount > 0) {
                        cust.balance -= paidAmount;
                        cust.transactions.push({
                            type: 'payment',
                            amount: paidAmount,
                            sale: createdSale._id,
                            description: `Payment for ${invoiceId}`
                        });
                    }

                    await cust.save();
                }
            }

            // Update Retailer Balance if linked (for wholesale sales)
            if (retailer) {
                const ret = await Retailer.findById(retailer);
                if (ret) {
                    // Add sale transaction (Debit - retailer owes us)
                    ret.transactions.push({
                        type: 'sale',
                        amount: totalAmount,
                        sale: createdSale._id,
                        description: `Sale Invoice ${invoiceId} - Total: Rs. ${totalAmount}`
                    });

                    // Add payment transaction if any (Credit - reduces what retailer owes)
                    if (paidAmount > 0) {
                        ret.transactions.push({
                            type: 'payment',
                            amount: paidAmount,
                            sale: createdSale._id,
                            description: `Payment for Invoice ${invoiceId}`
                        });
                    }

                    // Recalculate balance from all transactions
                    const totalSales = ret.transactions
                        .filter(t => t.type === 'sale')
                        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                    
                    const totalPurchases = ret.transactions
                        .filter(t => t.type === 'purchase')
                        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                    
                    const totalPaid = ret.transactions
                        .filter(t => t.type === 'payment')
                        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
                    
                    const totalDebit = totalSales + totalPurchases;
                    const remainingBalance = totalDebit - totalPaid;

                    console.log(`Sale Create - Retailer ${ret.name}: Sales=${totalSales}, Purchases=${totalPurchases}, Paid=${totalPaid}, Remaining=${remainingBalance}`);

                    // Update balances based on calculated values
                    ret.balance = remainingBalance;
                    ret.paidAmount = totalPaid;
                    ret.remainingBalance = remainingBalance;
                    
                    await ret.save();
                }
            }
        }

        const populatedSale = await Sale.findById(createdSale._id)
            .populate('items.product', 'name barcode')
            .populate('items.store', 'name printerEnabled printerEndpoint')
            .populate('store', 'name')
            .populate('customer', 'name phone');

        // Trigger IoT Printing per store and warehouse
        if (type === 'invoice') {
            const storeGroups = {};
            const warehouseGroups = {};
            
            populatedSale.items.forEach(item => {
                const sId = item.store._id.toString();
                if (!storeGroups[sId]) {
                    storeGroups[sId] = {
                        store: item.store,
                        items: []
                    };
                }
                storeGroups[sId].items.push(item);
            });

            // Iterate through each store and trigger print if enabled
            for (const sId in storeGroups) {
                const group = storeGroups[sId];
                if (group.store.printerEnabled && group.store.printerEndpoint) {
                    // Fire and forget or handle asynchronously
                    sendToPrinter(group.store, populatedSale, group.items, false).catch(err =>
                        console.error(`Printer trigger failed for ${group.store.name}:`, err)
                    );
                }
            }

            // Group items by warehouse and trigger warehouse receipt printing (without prices)
            // Use the productWarehouseMap to group items by their actual warehouse
            for (const item of populatedSale.items) {
                const productId = item.product._id.toString();
                const warehouseId = productWarehouseMap[productId];
                
                if (warehouseId) {
                    // Fetch warehouse details
                    const warehouse = await Warehouse.findById(warehouseId);
                    if (warehouse && warehouse.printerEnabled && warehouse.printerEndpoint) {
                        const wId = warehouse._id.toString();
                        if (!warehouseGroups[wId]) {
                            warehouseGroups[wId] = {
                                warehouse: warehouse,
                                items: []
                            };
                        }
                        warehouseGroups[wId].items.push(item);
                    }
                }
            }

            // Trigger warehouse receipt printing (without prices)
            // Each warehouse will receive receipt only for products sold from that warehouse
            for (const wId in warehouseGroups) {
                const group = warehouseGroups[wId];
                if (group.items.length > 0) {
                    console.log(`Sending receipt to ${group.warehouse.name} for ${group.items.length} item(s)`);
                    sendWarehouseReceipt(group.warehouse, populatedSale, group.items).catch(err =>
                        console.error(`Warehouse receipt printing failed for ${group.warehouse.name}:`, err)
                    );
                }
            }
        }

        res.status(201).json(populatedSale);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all sales
// @route   GET /api/sales
// @desc    Get all sales
// @route   GET /api/sales
const getSales = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const { startDate, endDate } = req.query;
        let query = { store: storeId };

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const sales = await Sale.find(query)
            .populate('items.product')
            .populate('salesman', 'name')
            .populate('store', 'name')
            .sort({ createdAt: -1 });

        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a sale (Void)
// @route   DELETE /api/sales/:id
const deleteSale = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (sale) {
            // Revert Stock
            for (const item of sale.items) {
                // Find inventory and return stock
                const inventory = await Inventory.findOne({ 
                    product: item.product
                });
                
                if (inventory) {
                    inventory.quantity += item.quantity;
                    await inventory.save();
                    
                    // Sync product totalStock from all warehouse inventories
                    await syncProductTotalStock(item.product);
                }
            }
            await sale.deleteOne();
            res.json({ message: 'Sale removed and stock reverted' });
        } else {
            res.status(404).json({ message: 'Sale not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Convert Quotation to Invoice
// @route   PUT /api/sales/:id/convert
const convertQuoteToInvoice = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        if (sale.type === 'invoice') {
            return res.status(400).json({ message: 'Already an invoice' });
        }

        // Change type and generate new Invoice ID
        sale.type = 'invoice';
        sale.invoiceId = `INV-${Date.now()}`;

        // Update Stock
        for (const item of sale.items) {
            const product = await Product.findById(item.product);
            if (product) {
                product.totalStock -= item.quantity;
                await product.save();

                const inventory = await Inventory.findOne({ product: item.product });
                if (inventory) {
                    inventory.quantity -= item.quantity;
                    await inventory.save();
                }
            }
        }

        // Update Customer Balance if linked
        if (sale.customer) {
            const cust = await Customer.findById(sale.customer);
            if (cust) {
                cust.balance += sale.totalAmount;
                cust.transactions.push({
                    type: 'sale',
                    amount: sale.totalAmount,
                    sale: sale._id,
                    description: `Converted from ${sale.type} to Invoice ${sale.invoiceId}`
                });

                // Check if there was any paid amount (usually quotes are unpaid, but just in case)
                if (sale.paidAmount > 0) {
                    cust.balance -= sale.paidAmount;
                    cust.transactions.push({
                        type: 'payment',
                        amount: sale.paidAmount,
                        sale: sale._id,
                        description: `Payment for ${sale.invoiceId}`
                    });
                }

                await cust.save();
            }
        }

        const updatedSale = await sale.save();
        res.json(updatedSale);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update sale metadata
// @route   PUT /api/sales/:id
const updateSale = async (req, res) => {
    const {
        customer, customerName, customerPhone,
        customerAddress, referenceNo, remarks, saleDate
    } = req.body;

    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({ message: 'Sale not found' });
        }

        // Update metadata only
        sale.customer = customer || sale.customer;
        sale.customerName = customerName !== undefined ? customerName : sale.customerName;
        sale.customerPhone = customerPhone !== undefined ? customerPhone : sale.customerPhone;
        sale.customerAddress = customerAddress !== undefined ? customerAddress : sale.customerAddress;
        sale.referenceNo = referenceNo !== undefined ? referenceNo : sale.referenceNo;
        sale.remarks = remarks !== undefined ? remarks : sale.remarks;
        sale.saleDate = saleDate ? new Date(saleDate) : sale.saleDate;

        const updatedSale = await sale.save();
        res.json(updatedSale);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createSale, getSales, deleteSale, convertQuoteToInvoice, updateSale };
