const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

function accessPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sellerId: user.seller_id || user.sellerId || null,
  };
}

function signAccessToken(user) {
  return jwt.sign(accessPayload(user), process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { path: '/api/auth' });
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
