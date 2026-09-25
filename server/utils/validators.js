import mongoose from 'mongoose';

export const MAX_BULK_IDS = 1000;

/**
 * Validates an array of IDs ensuring all elements are valid MongoDB ObjectIds.
 * @param {any} ids
 * @returns {boolean}
 */
export const validateIds = (ids) => (
  Array.isArray(ids) &&
  ids.length <= MAX_BULK_IDS &&
  ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))
);

/**
 * Validates standard email address format.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);
