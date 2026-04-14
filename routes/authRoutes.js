const express = require('express');
const router = express.Router();
const { loginUser, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.put('/profile', protect, updateMe);

module.exports = router;
