const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const VaultEntry = require('../models/VaultEntry');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: Generate JWT token and set it as HTTP-only cookie
 */
const sendTokenResponse = (user, statusCode, res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  };

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      masterPasswordHint: user.masterPasswordHint,
    },
  });
};

// ──────────────────────────────────────────────
// POST /api/auth/register
// Register a new user (single user app, but still needs auth)
// ──────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, masterPasswordHint, registrationKey } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Always require registration key validation
    const serverKey = process.env.REGISTRATION_KEY;
    if (!serverKey || registrationKey !== serverKey) {
      return res.status(403).json({
        success: false,
        message: 'Invalid registration key. To request a key, email rupeshkumar45670234@gmail.com.',
      });
    }

    const user = await User.create({
      email,
      password,
      masterPasswordHint: masterPasswordHint || '',
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// Login with email and password
// ──────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/logout
// Clear the auth cookie
// ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 5 * 1000), // Expire in 5 seconds
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  };

  res.cookie('token', 'none', cookieOptions);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

// ──────────────────────────────────────────────
// GET /api/auth/me
// Get current logged-in user info
// ──────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      masterPasswordHint: req.user.masterPasswordHint,
    },
  });
});

// ──────────────────────────────────────────────
// DELETE /api/auth/delete-account
// Delete current user account and all vault entries
// ──────────────────────────────────────────────
router.delete('/delete-account', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Delete all vault entries belonging to the user
    await VaultEntry.deleteMany({ user: userId });

    // 2. Delete the user account
    await User.findByIdAndDelete(userId);

    // 3. Clear cookie
    const cookieOptions = {
      expires: new Date(Date.now() + 5 * 1000), // 5 seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
    };
    res.cookie('token', 'none', cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Account and all vault data deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
