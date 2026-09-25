import express from 'express';
import authRoutes from './auth.routes.js';
import vaultRoutes from './vault.routes.js';
import { authLimiter, generalLimiter } from '../config/rateLimiter.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'VaultGuard API is running 🔐',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (with auth rate limiting)
router.use('/auth', authLimiter, authRoutes);

// Vault routes (with general rate limiting)
router.use('/vault', generalLimiter, vaultRoutes);

export default router;
