const mongoose = require('mongoose');
const Store = mongoose.model('Store', new mongoose.Schema({ name: String }));
require('dotenv').config();

async function checkStores() {
    await mongoose.connect(process.env.MONGO_URI);
    const stores = await Store.find();
    stores.forEach(s => {
        console.log(`ID: ${s._id}, Name: ${s.name}`);
    });
    process.exit(0);
}

checkStores();
