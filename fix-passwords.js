const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const fixPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        let count = 0;
        for (const user of users) {
            // bcrypt hashes usually start with $2a$ or $2b$
            if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
                console.log(`Hashing password for user: ${user.email}`);
                // Just save the user, the pre-save hook will handle it
                await user.save();
                count++;
            }
        }

        console.log(`Successfully fixed ${count} users`);
        process.exit(0);
    } catch (error) {
        console.error('Error fixing passwords:', error);
        process.exit(1);
    }
};

fixPasswords();
