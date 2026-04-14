const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            const secret = process.env.JWT_SECRET;
            
            if (!secret) {
                console.error('CRITICAL ERROR: JWT_SECRET is not defined in environment variables');
                return res.status(500).json({ message: 'Server configuration error' });
            }

            const token = jwt.sign({
                id: user._id,
                role: user.role,
                store: user.store ? user.store.toString() : null
            }, secret, {
                expiresIn: '30d'
            });

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                store: user.store,
                token
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error details:', {
            message: error.message,
            stack: error.stack,
            body: { email } // Log only email for safety
        });
        res.status(500).json({ message: 'Server error during login' });
    }
};

const updateMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                user.password = req.body.password;
            }

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                store: updatedUser.store
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { loginUser, updateMe };
