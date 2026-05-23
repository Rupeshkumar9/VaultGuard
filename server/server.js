const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');

const app = express();

// ──── Security Middleware ────

// Set security HTTP headers
app.use(helmet());

// Enable CORS for the frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // Allow cookies
  })
);

// Rate limiting - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login/register attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Max 100 requests per 15 minutes for general API
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

// ──── Body Parsing ────
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ──── Routes ────

// Health check
app.get('/api/health', (req, res) => {
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
