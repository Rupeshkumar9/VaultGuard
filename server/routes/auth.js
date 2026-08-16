const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
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
      name: user.name || '',
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
    const { name, email, password, masterPasswordHint, registrationKey } = req.body;

    if (!name || !String(name).trim() || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
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
      name: String(name).trim(),
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
      name: req.user.name || '',
      email: req.user.email,
      masterPasswordHint: req.user.masterPasswordHint,
    },
  });
});

// ──────────────────────────────────────────────
// PATCH /api/auth/profile
// Update profile details. An email change also replaces the user's encrypted
// vault payloads in the same MongoDB transaction.
// ──────────────────────────────────────────────
router.patch('/profile', protect, async (req, res, next) => {
  let session;

  try {
    const {
      name,
      email,
      currentPassword,
      vaultEntries,
    } = req.body;

    const nextName = name === undefined ? (req.user.name || '') : String(name).trim();
    const nextEmail = email === undefined ? req.user.email : String(email).trim().toLowerCase();

    if (nextName.length > 100) {
      const error = new Error('Name cannot exceed 100 characters.');
      error.statusCode = 400;
      throw error;
    }

    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      const error = new Error('Please enter a valid email address.');
      error.statusCode = 400;
      throw error;
    }

    const emailChanged = nextEmail !== req.user.email;
    if (emailChanged && (!currentPassword || typeof currentPassword !== 'string')) {
      const error = new Error('Current password is required to change your email.');
      error.statusCode = 400;
      throw error;
    }

    if (emailChanged && (!Array.isArray(vaultEntries) || vaultEntries.length > 1000)) {
      const error = new Error('A complete encrypted vault payload is required to change your email.');
      error.statusCode = 400;
      throw error;
    }

    if (emailChanged && vaultEntries.some((entry) => (
      !entry ||
      typeof entry.encryptedData !== 'string' ||
      typeof entry.iv !== 'string' ||
      typeof entry.salt !== 'string'
    ))) {
      const error = new Error('The encrypted vault payload is invalid.');
      error.statusCode = 400;
      throw error;
    }

    // Name-only edits do not need a MongoDB transaction or vault payload.
    if (!emailChanged) {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { name: nextName },
        { new: true, runValidators: true }
      );
      return sendTokenResponse(updatedUser, 200, res);
    }

    session = await mongoose.startSession();
    let updatedUser;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id).select('+password').session(session);
      if (!user) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
      }

      if (emailChanged && !(await user.comparePassword(currentPassword))) {
        const error = new Error('Current password is incorrect.');
        error.statusCode = 401;
        throw error;
      }

      if (emailChanged) {
        const existingUser = await User.findOne({
          email: nextEmail,
          _id: { $ne: user._id },
        }).session(session);

        if (existingUser) {
          const error = new Error('An account with this email already exists.');
          error.statusCode = 409;
          throw error;
        }

        const ids = vaultEntries.map((entry) => String(entry.id || entry._id));
        const uniqueIds = new Set(ids);
        if (ids.some((id) => !mongoose.isValidObjectId(id)) || uniqueIds.size !== ids.length) {
          const error = new Error('The encrypted vault payload contains invalid entry IDs.');
          error.statusCode = 400;
          throw error;
        }

        const existingEntries = await VaultEntry.find({
          _id: { $in: ids },
          user: user._id,
        }).select('_id').session(session);

        if (existingEntries.length !== ids.length) {
          const error = new Error('The encrypted vault payload is incomplete or invalid.');
          error.statusCode = 400;
          throw error;
        }

        if (vaultEntries.length > 0) {
          await VaultEntry.bulkWrite(
            vaultEntries.map((entry) => ({
              updateOne: {
                filter: { _id: entry.id || entry._id, user: user._id },
                update: {
                  $set: {
                    encryptedData: entry.encryptedData,
                    iv: entry.iv,
                    salt: entry.salt,
                  },
                },
              },
            })),
            { session }
          );
        }
      }

      user.name = nextName;
      user.email = nextEmail;
      await user.save({ session });
      updatedUser = user;
    });

    sendTokenResponse(updatedUser, 200, res);
  } catch (error) {
    next(error);
  } finally {
    if (session) await session.endSession();
  }
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
