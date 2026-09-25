import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import VaultEntry from '../models/VaultEntry.js';
import * as opaqueService from './opaque.service.js';

/**
 * Generate signed JWT for authenticated user.
 */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Get standard cookie configuration.
 */
export const getCookieOptions = (expiresInMs = 7 * 24 * 60 * 60 * 1000) => {
  return {
    expires: new Date(Date.now() + expiresInMs),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  };
};

/**
 * Helper: Send standardized JWT token response with HTTP-only cookie.
 */
export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  const cookieOptions = getCookieOptions();

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

/**
 * Verifies that the provided vault entries exactly match the user's existing vault entries.
 */
export const getCompleteVaultEntryIds = async (vaultEntries, userId, session) => {
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
 * Updates profile details. If email is changed, replaces user's encrypted vault
 * payloads in a single atomic MongoDB transaction.
 */
export const updateUserProfile = async ({ currentUser, nextName, nextEmail, vaultEntries }) => {
  const emailChanged = nextEmail !== currentUser.email;

  // Name-only updates do not need a transaction or vault payload
  if (!emailChanged) {
    return User.findByIdAndUpdate(
      currentUser._id,
      { name: nextName },
      { new: true, runValidators: true }
    );
  }

  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(currentUser._id).session(session);
      if (!user) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
      }

      const existingUser = await User.findOne({
        email: nextEmail,
        _id: { $ne: user._id },
      }).session(session);

      if (existingUser) {
        const error = new Error('An account with this email already exists.');
        error.statusCode = 409;
        throw error;
      }

      await getCompleteVaultEntryIds(vaultEntries, user._id, session);

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

      user.name = nextName;
      user.email = nextEmail;
      await user.save({ session });
      updatedUser = user;
    });

    return updatedUser;
  } finally {
    await session.endSession();
  }
};

/**
 * Changes master password and updates all encrypted vault payloads atomically.
 */
export const changeUserPassword = async ({ currentUser, opaqueChallengeId, opaqueRegistrationRecord, vaultEntries }) => {
  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(currentUser._id)
        .select('+opaqueIdentifier')
        .session(session);

      if (!user) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
      }

      const challenge = opaqueService.consumeChallenge(opaqueChallengeId, 'password');
      if (challenge.userId !== String(user._id)) {
        const error = new Error('Invalid OPAQUE password-change challenge.');
        error.statusCode = 401;
        throw error;
      }

      await getCompleteVaultEntryIds(vaultEntries, user._id, session);

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

    return updatedUser;
  } finally {
    await session.endSession();
  }
};

/**
 * Permanently deletes user and all associated vault entries.
 */
export const deleteUserAccount = async (userId) => {
  await VaultEntry.deleteMany({ user: userId });
  await User.findByIdAndDelete(userId);
};
