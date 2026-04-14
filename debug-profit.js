const mongoose = require('mongoose');
require('dotenv').config();

const saleItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
    totalAmount: { type: Number, required: true },
    items: [saleItemSchema],
    invoiceId: String,
    createdAt: Date
});

const Sale = mongoose.model('Sale', saleSchema);

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const sales = await Sale.find();
    console.log('--- INDIVIDUAL SALE PROFIT ANALYSIS ---');
    let totalComputedProfit = 0;

    sales.forEach(sale => {
        let cost = 0;
        sale.items.forEach(item => {
            cost += (item.costPrice || 0) * (item.quantity || 0);
        });
        const profit = sale.totalAmount - cost;
        totalComputedProfit += profit;
        console.log(`Invoice: ${sale.invoiceId} | Amount: ${sale.totalAmount} | Cost: ${cost} | Profit: ${profit}`);
    });

    console.log('---------------------------------------');
    console.log(`GRAND TOTAL COMPUTED PROFIT: ${totalComputedProfit}`);
    process.exit();
}

run();
