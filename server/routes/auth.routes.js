import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../config/rateLimiter.js';

const router = express.Router();

// OPAQUE authentication endpoints
router.post('/opaque/register/start', authLimiter, authController.startRegister);
router.post('/opaque/register/finish', authLimiter, authController.finishRegister);
router.post('/opaque/login/start',authLimiter, authController.startLogin);
router.post('/opaque/login/finish', authLimiter, authController.finishLogin);
router.post('/opaque/password/start', authLimiter, protect, authController.startPasswordChange);

// Session & user management endpoints
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, authController.updateProfile);
router.patch('/password', protect, authController.changePassword);
router.post('/logout', authController.logout);
router.delete('/delete-account', protect, authController.deleteAccount);

export default router;
