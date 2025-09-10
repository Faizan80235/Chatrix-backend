const express = require('express');
const router = express.Router();
const User = require('../models/User');

// ✅ Get all users except current user
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to fetch users',
      });
    }

    const users = await User.find({ email: { $ne: email } }).select('-password');

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;
