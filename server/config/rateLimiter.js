import rateLimit from 'express-rate-limit';

// Rate limiting - prevent brute force attacks
export const authLimiter = process.env.NODE_ENV === 'development'
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Max 10 attempts per 15 minutes in production
      message: {
        success: false,
        message: 'Too many attempts. Please try again after 15 minutes.',
      },
    });

export const generalLimiter = process.env.NODE_ENV === 'development'
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500, // Max 500 requests per 15 minutes in production to allow bulk operations
      message: {
        success: false,
        message: 'Too many requests. Please slow down.',
      },
    });
