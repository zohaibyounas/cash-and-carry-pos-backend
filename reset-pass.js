const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const resetPass = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456789', salt);

        await User.updateOne(
            { email: 'zohaiby737@gmail.com' },
            { $set: { password: hashedPassword } }
        );
        console.log('Password reset to 123456789');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

resetPass();
