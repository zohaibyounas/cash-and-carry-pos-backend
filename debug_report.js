const mongoose = require('mongoose');
const Sale = require('./models/Sale');
const moment = require('moment');
require('dotenv').config();

async function debug() {
    await mongoose.connect(process.env.MONGO_URI);
    const startDate = '2026-04-23';
    const endDate = '2026-04-23';

    const start = moment.utc(startDate).subtract(5, 'hours').toDate();
    const end = moment.utc(endDate).endOf('day').subtract(5, 'hours').toDate();
    
    console.log('Filter Range (UTC):', start.toISOString(), 'to', end.toISOString());

    const dateFilter = {
        createdAt: { $gte: start, $lte: end }
    };

    const sales = await Sale.find(dateFilter);
    console.log('Matching Sales Count:', sales.length);
    sales.forEach(s => {
        console.log(`- ID: ${s.invoiceId}, CreatedAt: ${s.createdAt.toISOString()}, Amount: ${s.totalAmount}, Store: ${s.store}`);
    });

    const aggregation = await Sale.aggregate([
        { $match: dateFilter },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:00" } },
                    saleId: "$_id",
                    paymentMethod: { $ifNull: ["$paymentMethod", "cash"] }
                },
                totalAmount: { $first: "$totalAmount" },
                cost: { $sum: { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
            }
        },
        {
            $group: {
                _id: { date: "$_id.date", paymentMethod: "$_id.paymentMethod" },
                sales: { $sum: "$totalAmount" },
            }
        }
    ]);
    console.log('Aggregation Result:', JSON.stringify(aggregation, null, 2));

    process.exit(0);
}

debug();
