import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { getCorsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Trust reverse proxy (necessary for rate limiting on Render/Heroku/AWS to read real client IP)
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet());

// CORS configuration (supports website origins & browser extensions)
app.use(cors(getCorsOptions()));

// Body & cookie parsers (profile email changes may include re-encrypted vault ciphertext)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API endpoints
app.use('/api', apiRoutes);

// Handle 404 for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// Global error handling middleware
app.use(errorHandler);

export default app;
