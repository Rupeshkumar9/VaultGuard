const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const VaultEntry = require('../models/VaultEntry');
const { protect } = require('../middleware/auth');
const opaqueAuth = require('../opaqueAuth');

const router = express.Router();

const getCompleteVaultEntryIds = async (vaultEntries, userId, session) => {
  const ids = vaultEntries.map((entry) => String(entry.id || entry._id || ''));
  const uniqueIds = new Set(ids);

  if (ids.some((id) => !mongoose.isValidObjectId(id)) || uniqueIds.size !== ids.length) {
    const error = new Error('The encrypted vault payload contains invalid entry IDs.');
    error.statusCode = 400;
    throw error;
  }

  const existingEntries = await VaultEntry.find({ user: userId })
    .select('_id')
    .session(session);
  const existingIds = new Set(existingEntries.map((entry) => String(entry._id)));

  if (existingIds.size !== ids.length || ids.some((id) => !existingIds.has(id))) {
    const error = new Error('The encrypted vault payload is incomplete or invalid.');
    error.statusCode = 400;
    throw error;
  }

  return ids;
};

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
      authScheme: 'opaque',
    },
  });
};

// ──────────────────────────────────────────────
// OPAQUE authentication endpoints
// ──────────────────────────────────────────────
router.post('/opaque/register/start', async (req, res, next) => {
  try {
    const { email, registrationRequest, registrationKey } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof registrationRequest !== 'string' || !registrationRequest) {
      return res.status(400).json({ success: false, message: 'Valid registration details are required.' });
    }
    if (!process.env.REGISTRATION_KEY || registrationKey !== process.env.REGISTRATION_KEY) {
      return res.status(403).json({ success: false, message: 'Invalid registration key.' });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const result = await opaqueAuth.createRegistrationResponse({
      userIdentifier: crypto.randomUUID(),
      registrationRequest,
      kind: 'register',
      email: normalizedEmail,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/opaque/register/finish', async (req, res, next) => {
  try {
    const {
      challengeId,
      email,
      name,
      masterPasswordHint,
      registrationKey,
      registrationRecord,
    } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
        typeof challengeId !== 'string' ||
        typeof registrationRecord !== 'string' ||
        !registrationRecord) {
      return res.status(400).json({ success: false, message: 'Valid registration details are required.' });
    }
    if (!process.env.REGISTRATION_KEY || registrationKey !== process.env.REGISTRATION_KEY) {
      return res.status(403).json({ success: false, message: 'Invalid registration key.' });
    }

    const challenge = opaqueAuth.consumeChallenge(challengeId, 'register');
    if (challenge.email !== normalizedEmail) {
      return res.status(401).json({ success: false, message: 'Invalid registration challenge.' });
    }
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: String(name || '').trim(),
      email: normalizedEmail,
      masterPasswordHint: masterPasswordHint || '',
      opaqueRegistration: registrationRecord,
      opaqueIdentifier: challenge.userIdentifier,
    });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
});

router.post('/opaque/login/start', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const startLoginRequest = req.body.startLoginRequest;
    if (!/^\S+@\S+\.\S+$/.test(email) || typeof startLoginRequest !== 'string' || !startLoginRequest) {
      return res.status(400).json({ success: false, message: 'Invalid login request.' });
    }

    const user = await User.findOne({ email }).select('+opaqueRegistration +opaqueIdentifier');
    if (!user?.opaqueRegistration) {
      return res.status(404).json({ success: false, message: 'OPAQUE authentication is not enrolled.' });
    }

    const result = await opaqueAuth.startLogin({
      userIdentifier: user.opaqueIdentifier,
      registrationRecord: user.opaqueRegistration,
      startLoginRequest,
      email,
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/opaque/login/finish', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { challengeId, finishLoginRequest } = req.body;
    if (!/^\S+@\S+\.\S+$/.test(email) || typeof challengeId !== 'string' || typeof finishLoginRequest !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid login request.' });
    }

    await opaqueAuth.finishLogin({ challengeId, finishLoginRequest, email });
    const user = await User.findOne({ email }).select('+opaqueRegistration');
    if (!user?.opaqueRegistration) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    sendTokenResponse(user, 200, res);
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    next(error);
  }
});

router.post('/opaque/password/start', protect, async (req, res, next) => {
  try {
    if (typeof req.body.registrationRequest !== 'string' || !req.body.registrationRequest) {
      return res.status(400).json({ success: false, message: 'Invalid OPAQUE password-change request.' });
    }
    const user = await User.findById(req.user._id).select('+opaqueIdentifier');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });

    const userIdentifier = user.opaqueIdentifier || crypto.randomUUID();
    const result = await opaqueAuth.createRegistrationResponse({
      userIdentifier,
      registrationRequest: req.body.registrationRequest,
      kind: 'password',
      userId: String(user._id),
      email: user.email,
    });
    res.status(200).json({ success: true, ...result });
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
      authScheme: 'opaque',
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
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
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

        const ids = await getCompleteVaultEntryIds(vaultEntries, user._id, session);

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
// PATCH /api/auth/password
// Change the master password and replace the encrypted vault payloads in one transaction.
// ──────────────────────────────────────────────
router.patch('/password', protect, async (req, res, next) => {
  let session;

  try {
    const { opaqueChallengeId, opaqueRegistrationRecord, vaultEntries } = req.body;

    if (typeof opaqueChallengeId !== 'string' ||
        typeof opaqueRegistrationRecord !== 'string' ||
        !opaqueRegistrationRecord) {
      const error = new Error('A valid OPAQUE password-change request is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(vaultEntries) || vaultEntries.length > 1000) {
      const error = new Error('A complete encrypted vault payload is required to change your password.');
      error.statusCode = 400;
      throw error;
    }

    if (vaultEntries.some((entry) => (
      !entry ||
      typeof entry.encryptedData !== 'string' ||
      typeof entry.iv !== 'string' ||
      typeof entry.salt !== 'string'
    ))) {
      const error = new Error('The encrypted vault payload is invalid.');
      error.statusCode = 400;
      throw error;
    }

    session = await mongoose.startSession();
    let updatedUser;

    await session.withTransaction(async () => {
      const user = await User.findById(req.user._id)
        .select('+opaqueIdentifier')
        .session(session);
      if (!user) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
      }

      const challenge = opaqueAuth.consumeChallenge(opaqueChallengeId, 'password');
      if (challenge.userId !== String(user._id)) {
        const error = new Error('Invalid OPAQUE password-change challenge.');
        error.statusCode = 401;
        throw error;
      }

      const ids = await getCompleteVaultEntryIds(vaultEntries, user._id, session);

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

      user.opaqueRegistration = opaqueRegistrationRecord;
      user.opaqueIdentifier = user.opaqueIdentifier || crypto.randomUUID();
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
