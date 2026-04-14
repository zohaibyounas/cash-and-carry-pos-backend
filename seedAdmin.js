const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB for Seeding');

        const adminEmail = 'zohaibydev@gmail.com';
        const adminPass = '123456789';

        // Check if admin exists and delete if it does so we can recreate it with correct password
        const userExists = await User.findOne({ email: adminEmail });
        if (userExists) {
            console.log('Deleting corrupted admin user...');
            await User.deleteOne({ email: adminEmail });
        }

        const adminUser = new User({
            name: 'Admin',
            email: adminEmail,
            password: adminPass, // Pass plaintext! Pre-save hook will hash it.
            role: 'admin'
        });

        await adminUser.save();
        console.log('Admin user seeded successfully');
        process.exit();
    }).catch((err) => {
        console.error('Error seeding admin:', err);
        process.exit(1);
    });
