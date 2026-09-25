import crypto from 'crypto';
import User from '../models/User.js';
import * as opaqueService from '../services/opaque.service.js';
import * as authService from '../services/auth.service.js';
import { isValidEmail } from '../utils/validators.js';

export const startRegister = async (req, res, next) => {
  try {
    const { email, registrationRequest } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isValidEmail(normalizedEmail) || typeof registrationRequest !== 'string' || !registrationRequest) {
      return res.status(400).json({ success: false, message: 'Valid registration details are required.' });
    }

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const result = await opaqueService.createRegistrationResponse({
      userIdentifier: crypto.randomUUID(),
      registrationRequest,
      kind: 'register',
      email: normalizedEmail,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const finishRegister = async (req, res, next) => {
  try {
    const {
      challengeId,
      email,
      name,
      masterPasswordHint,
      registrationRecord,
    } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isValidEmail(normalizedEmail) ||
        typeof challengeId !== 'string' ||
        typeof registrationRecord !== 'string' ||
        !registrationRecord) {
      return res.status(400).json({ success: false, message: 'Valid registration details are required.' });
    }

    const challenge = opaqueService.consumeChallenge(challengeId, 'register');
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

    authService.sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

export const startLogin = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const startLoginRequest = req.body.startLoginRequest;

    if (!isValidEmail(email) || typeof startLoginRequest !== 'string' || !startLoginRequest) {
      return res.status(400).json({ success: false, message: 'Invalid login request.' });
    }

    const user = await User.findOne({ email }).select('+opaqueRegistration +opaqueIdentifier');
    if (!user?.opaqueRegistration) {
      return res.status(404).json({ success: false, message: 'OPAQUE authentication is not enrolled.' });
    }

    const result = await opaqueService.startLogin({
      userIdentifier: user.opaqueIdentifier,
      registrationRecord: user.opaqueRegistration,
      startLoginRequest,
      email,
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const finishLogin = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { challengeId, finishLoginRequest } = req.body;

    if (!isValidEmail(email) || typeof challengeId !== 'string' || typeof finishLoginRequest !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid login request.' });
    }

    await opaqueService.finishLogin({ challengeId, finishLoginRequest, email });
    const user = await User.findOne({ email }).select('+opaqueRegistration');
    if (!user?.opaqueRegistration) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    authService.sendTokenResponse(user, 200, res);
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    next(error);
  }
};

export const startPasswordChange = async (req, res, next) => {
  try {
    if (typeof req.body.registrationRequest !== 'string' || !req.body.registrationRequest) {
      return res.status(400).json({ success: false, message: 'Invalid OPAQUE password-change request.' });
    }

    const user = await User.findById(req.user._id).select('+opaqueIdentifier');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });

    const userIdentifier = user.opaqueIdentifier || crypto.randomUUID();
    const result = await opaqueService.createRegistrationResponse({
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
};

export const getMe = async (req, res) => {
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
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, vaultEntries } = req.body;
    const nextName = name === undefined ? (req.user.name || '') : String(name).trim();
    const nextEmail = email === undefined ? req.user.email : String(email).trim().toLowerCase();

    if (nextName.length > 100) {
      const error = new Error('Name cannot exceed 100 characters.');
      error.statusCode = 400;
      throw error;
    }

    if (!isValidEmail(nextEmail)) {
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

    const updatedUser = await authService.updateUserProfile({
      currentUser: req.user,
      nextName,
      nextEmail,
      vaultEntries,
    });

    authService.sendTokenResponse(updatedUser, 200, res);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
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

    const updatedUser = await authService.changeUserPassword({
      currentUser: req.user,
      opaqueChallengeId,
      opaqueRegistrationRecord,
      vaultEntries,
    });

    authService.sendTokenResponse(updatedUser, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = (_req, res) => {
  const cookieOptions = authService.getCookieOptions(5 * 1000); // Expire in 5 seconds
  res.cookie('token', 'none', cookieOptions);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

export const deleteAccount = async (req, res, next) => {
  try {
    await authService.deleteUserAccount(req.user._id);

    const cookieOptions = authService.getCookieOptions(5 * 1000);
    res.cookie('token', 'none', cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Account and all vault data deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
