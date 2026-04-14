const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');

// Helper to get active store
const getActiveStore = (req) => {
    return req.user.store || req.headers['x-store-id'];
};

// @desc    Get dashboard stats
// @route   GET /api/analytics/dashboard
const getDashboardStats = async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const storeObjectId = new mongoose.Types.ObjectId(storeId);

        let dateFilter = { store: storeObjectId };
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Sales Stats (filtered)
        const salesStats = await Sale.aggregate([
            { $match: dateFilter },
            { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$_id",
                    totalAmount: { $first: "$totalAmount" },
                    cost: { $sum: { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" },
                    totalProfit: { $sum: { $subtract: ["$totalAmount", "$cost"] } },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Purchase Stats (filtered)
        const purchaseStats = await Purchase.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        // Expense Stats (filtered)
        const expenseStats = await Expense.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // Global Inventory Stats (filtered by store)
        const inventorySummary = await Product.aggregate([
            { $match: { store: storeObjectId } },
            {
                $group: {
                    _id: null,
                    totalCost: {
                        $sum: {
                            $multiply: [
                                {
                                    $cond: {
                                        if: { $and: ["$hasPieces", { $gt: ["$piecesPerBox", 0] }] },
                                        then: { $divide: ["$costPrice", "$piecesPerBox"] },
                                        else: "$costPrice"
                                    }
                                },
                                { $cond: { if: { $gt: ["$totalStock", 0] }, then: "$totalStock", else: 0 } }
                            ]
                        }
                    },
                    totalItems: {
                        $sum: { $cond: { if: { $gt: ["$totalStock", 0] }, then: "$totalStock", else: 0 } }
                    }
                }
            }
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Trend aggregation (Sales & Profit)
        const salesTrend = await Sale.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, store: storeObjectId } },
            { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: {
                        id: "$_id",
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    totalAmount: { $first: "$totalAmount" },
                    cost: { $sum: { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    sales: { $sum: "$totalAmount" },
                    profit: { $sum: { $subtract: ["$totalAmount", "$cost"] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Trend aggregation (Purchases)
        const purchaseTrend = await Purchase.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo }, store: storeObjectId } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    purchases: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Merge trends
        const trend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - i);
            const ds = d.toISOString().split('T')[0];

            const sT = salesTrend.find(t => t._id === ds) || { sales: 0, profit: 0 };
            const pT = purchaseTrend.find(t => t._id === ds) || { purchases: 0 };

            trend.push({
                date: ds,
                sales: sT.sales || 0,
                profit: sT.profit || 0,
                purchases: pT.purchases || 0
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const todayData = trend.find(t => t.date === todayStr) || { sales: 0, profit: 0 };

        res.json({
            totalSales: salesStats[0]?.totalRevenue || 0,
            saleCount: salesStats[0]?.count || 0,
            totalProfit: salesStats[0]?.totalProfit || 0,
            todaySales: todayData.sales,
            todayProfit: todayData.profit,
            totalPurchases: purchaseStats[0]?.total || 0,
            totalExpenses: expenseStats[0]?.total || 0,
            totalInventoryItems: inventorySummary[0]?.totalItems || 0,
            totalInventoryCost: inventorySummary[0]?.totalCost || 0,
            trend,
            monthlyProfitTrend: []
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Sales Report
// @route   GET /api/analytics/sales-report
const getSalesReport = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        let dateFilter = { store: storeId };
        if (startDate && endDate) {
            dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const sales = await Sale.find(dateFilter)
            .populate('salesman', 'name')
            .populate('store', 'name')
            .sort({ createdAt: -1 });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Top Selling Products
// @route   GET /api/analytics/top-selling
const getTopSelling = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });
        const storeObjectId = new mongoose.Types.ObjectId(storeId);

        const topProducts = await Sale.aggregate([
            { $match: { store: storeObjectId } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    totalQty: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: "$items.total" }
                }
            },
            { $sort: { totalQty: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productInfo' } },
            { $unwind: "$productInfo" }
        ]);
        res.json(topProducts);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Stock Report
// @route   GET /api/analytics/stock-report
const getStockReport = async (req, res) => {
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        const products = await Product.find({ store: storeId })
            .select('name barcode costPrice salePrice totalStock category hasPieces piecesPerBox pieceCostPrice pieceSalePrice')
            .sort({ name: 1 });

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Profit & Loss Report
// @route   GET /api/analytics/pnl-report
const getPnLReport = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });
        const storeObjectId = new mongoose.Types.ObjectId(storeId);

        let dateFilter = { store: storeObjectId };
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Sales and Profit from Sales
        const salesProfit = await Sale.aggregate([
            { $match: dateFilter },
            { $unwind: "$items" },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalCost: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } }
                }
            }
        ]);

        // Expenses
        const expenseTotal = await Expense.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const grossProfit = (salesProfit[0]?.totalSales || 0) - (salesProfit[0]?.totalCost || 0);
        const netProfit = grossProfit - (expenseTotal[0]?.total || 0);

        res.json({
            revenue: salesProfit[0]?.totalSales || 0,
            costOfGoodsSold: salesProfit[0]?.totalCost || 0,
            grossProfit,
            expenses: expenseTotal[0]?.total || 0,
            netProfit
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Inventory Invoices (Purchase History)
// @route   GET /api/analytics/inventory-invoices
const getInventoryInvoices = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });

        let dateFilter = { store: storeId };
        if (startDate && endDate) {
            dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const purchases = await Purchase.find(dateFilter)
            .sort({ createdAt: -1 });
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Financial Report (Daily Summary)
// @route   GET /api/analytics/financial-report
const getFinancialReport = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const storeId = getActiveStore(req);
        if (!storeId) return res.status(400).json({ message: 'Store context required' });
        const storeObjectId = new mongoose.Types.ObjectId(storeId);

        let dateFilter = { store: storeObjectId };
        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Aggregate Daily Sales
        const dailySales = await Sale.aggregate([
            { $match: dateFilter },
            { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        saleId: "$_id"
                    },
                    totalAmount: { $first: "$totalAmount" },
                    cost: { $sum: { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    sales: { $sum: "$totalAmount" },
                    profit: { $sum: { $subtract: ["$totalAmount", "$cost"] } }
                }
            }
        ]);

        // Aggregate Daily Purchases
        const dailyPurchases = await Purchase.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    purchases: { $sum: "$totalAmount" }
                }
            }
        ]);

        // Aggregate Daily Expenses
        const dailyExpenses = await Expense.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    expenses: { $sum: "$amount" }
                }
            }
        ]);

        // Merge Trends
        const dates = new Set([
            ...dailySales.map(d => d._id),
            ...dailyPurchases.map(d => d._id),
            ...dailyExpenses.map(d => d._id)
        ]);

        const summary = Array.from(dates).map(date => {
            const s = dailySales.find(d => d._id === date) || { sales: 0, profit: 0 };
            const p = dailyPurchases.find(d => d._id === date) || { purchases: 0 };
            const e = dailyExpenses.find(d => d._id === date) || { expenses: 0 };

            return {
                date,
                sales: s.sales || 0,
                purchases: p.purchases || 0,
                expenses: e.expenses || 0,
                profit: s.profit || 0,
                netProfit: (s.profit || 0) - (e.expenses || 0)
            };
        }).sort((a, b) => b.date.localeCompare(a.date));

        res.json(summary);
    } catch (error) {
        console.error('Financial Report Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getDashboardStats,
    getSalesReport,
    getTopSelling,
    getStockReport,
    getPnLReport,
    getInventoryInvoices,
    getFinancialReport
};
