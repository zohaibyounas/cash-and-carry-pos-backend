const moment = require("moment-timezone");
moment.tz.setDefault("Asia/Karachi");
const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Expense = require("../models/Expense");
const Purchase = require("../models/Purchase");

// Helper to get active store
const getActiveStore = (req) => {
  return req.user.store || req.headers["x-store-id"];
};

// @desc    Get dashboard stats
// @route   GET /api/analytics/dashboard
const getDashboardStats = async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });

    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    let dateFilter = { 
      store: storeObjectId,
      type: { $in: ['invoice', 'return', 'exchange'] }
    };
    if (startDate && endDate) {
      // Using Asia/Karachi default timezone set above
      const start = moment(startDate).startOf("day").toDate();
      const end = moment(endDate).endOf("day").toDate();
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
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
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.costPrice", 0] },
                { $ifNull: ["$items.quantity", 0] },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalProfit: { $sum: { $subtract: ["$totalAmount", "$cost"] } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Purchase Stats (filtered)
    const purchaseStats = await Purchase.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    // Expense Stats (filtered)
    const expenseStats = await Expense.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
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
                    else: "$costPrice",
                  },
                },
                {
                  $cond: {
                    if: { $gt: ["$totalStock", 0] },
                    then: "$totalStock",
                    else: 0,
                  },
                },
              ],
            },
          },
          totalItems: {
            $sum: {
              $cond: {
                if: { $gt: ["$totalStock", 0] },
                then: "$totalStock",
                else: 0,
              },
            },
          },
        },
      },
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
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "+05:00",
              },
            },
          },
          totalAmount: { $first: "$totalAmount" },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.costPrice", 0] },
                { $ifNull: ["$items.quantity", 0] },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          sales: { $sum: "$totalAmount" },
          profit: { $sum: { $subtract: ["$totalAmount", "$cost"] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Trend aggregation (Purchases)
    const purchaseTrend = await Purchase.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, store: storeObjectId } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "+05:00",
            },
          },
          purchases: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge trends
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const ds = moment(d).format("YYYY-MM-DD");

      const sT = salesTrend.find((t) => t._id === ds) || {
        sales: 0,
        profit: 0,
      };
      const pT = purchaseTrend.find((t) => t._id === ds) || { purchases: 0 };

      trend.push({
        date: ds,
        sales: sT.sales || 0,
        profit: sT.profit || 0,
        purchases: pT.purchases || 0,
      });
    }

    const todayStr = moment().format("YYYY-MM-DD");
    const todayData = trend.find((t) => t.date === todayStr) || {
      sales: 0,
      profit: 0,
    };

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
      monthlyProfitTrend: [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Sales Report
// @route   GET /api/analytics/sales-report
const getSalesReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });

    let dateFilter = { 
      store: storeId,
      type: { $in: ['invoice', 'return', 'exchange'] }
    };
    if (startDate && endDate) {
      // Using Asia/Karachi default timezone set above
      const start = moment(startDate).startOf("day").toDate();
      const end = moment(endDate).endOf("day").toDate();
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    const sales = await Sale.find(dateFilter)
      .populate("salesman", "name")
      .populate("store", "name")
      .sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Top Selling Products
// @route   GET /api/analytics/top-selling
const getTopSelling = async (req, res) => {
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    const topProducts = await Sale.aggregate([
      { $match: { store: storeObjectId, type: { $in: ['invoice', 'return', 'exchange'] } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalQty: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.total" },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
    ]);
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Stock Report
// @route   GET /api/analytics/stock-report
const getStockReport = async (req, res) => {
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });

    const products = await Product.find({ store: storeId })
      .select(
        "name barcode costPrice salePrice totalStock category hasPieces piecesPerBox pieceCostPrice pieceSalePrice",
      )
      .sort({ name: 1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Profit & Loss Report
// @route   GET /api/analytics/pnl-report
const getPnLReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    let dateFilter = { 
      store: storeObjectId,
      type: { $in: ['invoice', 'return', 'exchange'] }
    };
    if (startDate && endDate) {
      // Using Asia/Karachi default timezone set above
      const start = moment(startDate).startOf("day").toDate();
      const end = moment(endDate).endOf("day").toDate();
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    // Sales and Profit from Sales
    const salesProfit = await Sale.aggregate([
      { $match: dateFilter },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          totalAmount: { $first: "$totalAmount" },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.costPrice", 0] },
                { $ifNull: ["$items.quantity", 0] },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalCost: { $sum: "$cost" },
        },
      },
    ]);

    // Expenses
    const expenseTotal = await Expense.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const grossProfit =
      (salesProfit[0]?.totalSales || 0) - (salesProfit[0]?.totalCost || 0);
    const netProfit = grossProfit - (expenseTotal[0]?.total || 0);

    res.json({
      revenue: salesProfit[0]?.totalSales || 0,
      costOfGoodsSold: salesProfit[0]?.totalCost || 0,
      grossProfit,
      expenses: expenseTotal[0]?.total || 0,
      netProfit,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Inventory Invoices (Purchase History)
// @route   GET /api/analytics/inventory-invoices
const getInventoryInvoices = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });

    let dateFilter = { store: storeId };
    if (startDate && endDate) {
      // Using Asia/Karachi default timezone set above
      const start = moment(startDate).startOf("day").toDate();
      const end = moment(endDate).endOf("day").toDate();
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    const purchases = await Purchase.find(dateFilter).sort({ createdAt: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get Financial Report (Individual Transaction Ledger)
// @route   GET /api/analytics/financial-report
const getFinancialReport = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const storeId = getActiveStore(req);
    if (!storeId)
      return res.status(400).json({ message: "Store context required" });
    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    let dateFilter = { store: storeObjectId };
    if (startDate && endDate) {
      const start = moment(startDate).startOf("day").toDate();
      const end = moment(endDate).endOf("day").toDate();
      dateFilter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    // Individual Sales with Profit and Product Names
    const sales = await Sale.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          type: { $in: ['invoice', 'return', 'exchange'] } 
        } 
      },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          totalAmount: { $first: "$totalAmount" },
          type: { $first: "$type" },
          createdAt: { $first: "$createdAt" },
          paymentMethod: { $first: { $ifNull: ["$paymentMethod", "cash"] } },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.costPrice", 0] },
                { $ifNull: ["$items.quantity", 0] },
              ],
            },
          },
          productNames: {
            $addToSet: {
              $concat: [
                { $cond: [{ $eq: ["$type", "return"] }, "(RET) ", { $cond: [{ $eq: ["$type", "exchange"] }, "(EXC) ", ""] }] },
                { $ifNull: ["$productInfo.name", "Unknown Product"] }
              ]
            }
          },
        },
      },
    ]);

    // Individual Purchases
    const purchases = await Purchase.find(dateFilter).lean();

    // Individual Expenses
    const expenses = await Expense.find(dateFilter).lean();

    // Combine into a flat ledger
    const summary = [];

    sales.forEach((s) => {
      const profit = s.totalAmount - s.cost;
      summary.push({
        _id: s._id,
        date: s.createdAt,
        productNames: s.productNames,
        cashSales: s.paymentMethod === "cash" ? s.totalAmount : 0,
        cardSales: s.paymentMethod === "card" ? s.totalAmount : 0,
        bankTransferSales: s.paymentMethod === "bank_transfer" ? s.totalAmount : 0,
        sales: s.totalAmount,
        returns: s.type === "return" ? s.totalAmount : 0,
        exchanges: s.type === "exchange" ? s.totalAmount : 0,
        purchases: 0,
        expenses: 0,
        profit: profit,
        netProfit: profit,
      });
    });

    purchases.forEach((p) => {
      summary.push({
        _id: p._id,
        date: p.createdAt || p.date,
        productNames: [`Purchase: ${p.vendorName}`],
        cashSales: 0,
        cardSales: 0,
        bankTransferSales: 0,
        sales: 0,
        returns: 0,
        exchanges: 0,
        purchases: p.totalAmount,
        expenses: 0,
        profit: 0,
        netProfit: 0, // Purchases are stock assets, not immediate P&L impact (COGS handles that)
      });
    });

    expenses.forEach((e) => {
      summary.push({
        _id: e._id,
        date: e.createdAt || e.date,
        productNames: [`Expense: ${e.title} (${e.category})`],
        cashSales: 0,
        cardSales: 0,
        bankTransferSales: 0,
        sales: 0,
        returns: 0,
        exchanges: 0,
        purchases: 0,
        expenses: e.amount,
        profit: 0,
        netProfit: -e.amount,
      });
    });

    // Final Sort: Most recent first
    summary.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(summary);
  } catch (error) {
    console.error("Financial Report Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getDashboardStats,
  getSalesReport,
  getTopSelling,
  getStockReport,
  getPnLReport,
  getInventoryInvoices,
  getFinancialReport,
};
