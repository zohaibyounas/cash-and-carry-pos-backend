const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Test with the salesman user found earlier
        const email = 'salemen@gmail.com';
        const plainPassword = '123'; // I assume this was the plain password based on the previous state or just common dev passwords, 
        // actually I don't know the password. Let me check the seedAdmin.js or just create a new test user.

        console.log('Creating test user...');
        const testEmail = 'test_salesman@example.com';
        const testPassword = 'password123';

        // Delete if exists
        await User.deleteOne({ email: testEmail });

        const newUser = new User({
            name: 'Test Salesman',
            email: testEmail,
            password: testPassword,
            role: 'salesman'
        });

        await newUser.save();
        console.log('Test user created and password hashed automatically.');

        const user = await User.findOne({ email: testEmail });
        console.log('Stored password:', user.password);

        const isMatch = await user.comparePassword(testPassword);
        console.log('Login match:', isMatch);

        if (isMatch) {
            console.log('VERIFICATION SUCCESSFUL');
        } else {
            console.log('VERIFICATION FAILED');
        }

        // Cleanup
        await User.deleteOne({ email: testEmail });
        process.exit(0);
    } catch (error) {
        console.error('Error during verification:', error);
        process.exit(1);
    }
};

testLogin();
