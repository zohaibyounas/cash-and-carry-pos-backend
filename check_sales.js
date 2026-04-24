const mongoose = require('mongoose');
const Sale = require('./models/Sale');
require('dotenv').config();

async function checkSales() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cash-carry');
    const sales = await Sale.find().sort({ createdAt: -1 }).limit(50);
    console.log('Current Time:', new Date().toISOString());
    sales.forEach(s => {
        console.log(`ID: ${s.invoiceId}, CreatedAt: ${s.createdAt.toISOString()}, SaleDate: ${s.saleDate ? s.saleDate.toISOString() : 'N/A'}, Amount: ${s.totalAmount}`);
    });
    process.exit(0);
}

checkSales();
