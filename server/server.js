/**
 * VaultGuard - Zero-Knowledge Password Manager
 * Developed by Rupesh (https://github.com/rupeshkumar9)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';

const app = express();

// Trust reverse proxy (necessary for rate limiting on Render/Heroku/AWS to read the real client IP)
app.set('trust proxy', 1);

// ──── Security Middleware ────

// Set security HTTP headers
app.use(helmet());

// Keep website origins explicitly configured, but recognize browser-extension
// origins automatically. Extension IDs can differ for manually loaded copies,
// so requiring every user to add an ID to the server environment is not viable.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost',
  'capacitor://localhost'
];
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach(o => allowedOrigins.push(o.trim()));
}
if (process.env.EXTENSION_ORIGINS) {
  process.env.EXTENSION_ORIGINS.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .forEach(origin => allowedOrigins.push(origin));
}

function isBrowserExtensionOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const isSupportedProtocol = parsed.protocol === 'chrome-extension:' || parsed.protocol === 'moz-extension:';

    // Extension origins have an opaque host identifier and no credentials,
    // port, or path. This intentionally does not allow arbitrary web origins.
    return isSupportedProtocol &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      (parsed.pathname === '/' || parsed.pathname === '');
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin are kept for native clients and CLI health
      // checks. Website origins remain explicitly allowlisted, while browser
      // extensions are authorized by their restricted extension protocols.
      if (!origin || allowedOrigins.includes(origin) || isBrowserExtensionOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies
  })
);

// Rate limiting - prevent brute force attacks
const authLimiter = process.env.NODE_ENV === 'development'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Max 10 attempts per 15 minutes in production
      message: {
        success: false,
        message: 'Too many attempts. Please try again after 15 minutes.',
      },
    });

const generalLimiter = process.env.NODE_ENV === 'development'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500, // Increased to 500 in production to allow bulk imports
      message: {
        success: false,
        message: 'Too many requests. Please slow down.',
      },
    });

// ──── Body Parsing ────
// Profile email changes may include re-encrypted vault ciphertext. The
// ciphertext is still opaque to the server, but a normal vault can exceed 10kb.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ──── Routes ────

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'VaultGuard API is running 🔐',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (with stricter rate limiting)
app.use('/api/auth', authLimiter, authRoutes);

// Vault routes (with general rate limiting)
app.use('/api/vault', generalLimiter, vaultRoutes);

// Handle 404 for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// ──── Error Handling ────
app.use(errorHandler);

// ──── Start Server ────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🔐 VaultGuard Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
};

startServer();
