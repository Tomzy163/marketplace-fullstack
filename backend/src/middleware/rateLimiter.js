const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

const apiRateLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authRateLimiter,
  apiRateLimiter,
};
