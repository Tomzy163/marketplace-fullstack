const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function accessPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sellerId: user.seller_id || user.sellerId || null,
  };
}

function signAccessToken(user) {
  return jwt.sign(accessPayload(user), env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_DAYS);
  return expiresAt;
}

function setRefreshCookie(res, token) {
  const options = {
    httpOnly: true,
    secure: env.REFRESH_COOKIE_SECURE,
    sameSite: env.REFRESH_COOKIE_SAMESITE,
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  };

  if (env.REFRESH_COOKIE_DOMAIN) {
    options.domain = env.REFRESH_COOKIE_DOMAIN;
  }

  res.cookie(env.REFRESH_COOKIE_NAME, token, options);
}

function clearRefreshCookie(res) {
  const options = { path: '/api/auth' };
  if (env.REFRESH_COOKIE_DOMAIN) {
    options.domain = env.REFRESH_COOKIE_DOMAIN;
  }
  res.clearCookie(env.REFRESH_COOKIE_NAME, options);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  setRefreshCookie,
  clearRefreshCookie,
};
