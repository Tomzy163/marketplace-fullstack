const bcrypt = require('bcryptjs');
const Joi = require('joi');
const passport = require('passport');
const router = require('express').Router();
const { getClient, query } = require('../config/db');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { auditLog } = require('../services/auditService');
const {
  clearRefreshCookie,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  setRefreshCookie,
  signAccessToken,
} = require('../utils/tokens');

const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('seller', 'customer').default('customer'),
  storeName: Joi.when('role', {
    is: 'seller',
    then: Joi.string().trim().min(2).max(120).required(),
    otherwise: Joi.any().strip(),
  }),
  slug: Joi.when('role', {
    is: 'seller',
    then: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).min(3).max(80).required(),
    otherwise: Joi.any().strip(),
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sellerId: user.seller_id || null,
    subscriptionStatus: user.subscription_status || null,
  };
}

async function persistRefreshToken(db, userId, token, req) {
  const expiresAt = refreshExpiry();
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      hashRefreshToken(token),
      req.headers['user-agent'] || null,
      req.ip || null,
      expiresAt,
    ],
  );
  return expiresAt;
}

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const client = await getClient();
    const refreshToken = generateRefreshToken();

    try {
      await client.query('BEGIN');

      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const createdUser = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role`,
        [req.body.email, passwordHash, req.body.role],
      );

      let user = createdUser.rows[0];

      if (req.body.role === 'seller') {
        const seller = await client.query(
          `INSERT INTO sellers (user_id, store_name, slug, subscription_status)
           VALUES ($1, $2, $3, 'pending')
           RETURNING id, subscription_status`,
          [user.id, req.body.storeName, req.body.slug],
        );
        user = {
          ...user,
          seller_id: seller.rows[0].id,
          subscription_status: seller.rows[0].subscription_status,
        };
      }

      await persistRefreshToken(client, user.id, refreshToken, req);
      await auditLog(client, {
        userId: user.id,
        action: 'auth.register',
        resource: 'users',
        resourceId: user.id,
      });

      await client.query('COMMIT');
      setRefreshCookie(res, refreshToken);

      return res.status(201).json({
        accessToken: signAccessToken(user),
        user: publicUser(user),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Email or store slug already exists' });
      }
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.email, u.password_hash, u.role, s.id AS seller_id, s.subscription_status
         FROM users u
         LEFT JOIN sellers s ON s.user_id = u.id
       WHERE u.email = $1`,
      [req.body.email],
    );

    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(req.body.password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const client = await getClient();
    const refreshToken = generateRefreshToken();

    try {
      await client.query('BEGIN');
      await persistRefreshToken(client, user.id, refreshToken, req);
      await auditLog(client, {
        userId: user.id,
        action: 'auth.login',
        resource: 'users',
        resourceId: user.id,
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    setRefreshCookie(res, refreshToken);
    return res.json({
      accessToken: signAccessToken(user),
      user: publicUser(user),
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const { rows } = await query(
      `SELECT rt.id AS refresh_token_id,
              u.id, u.email, u.role,
              s.id AS seller_id,
              s.subscription_status
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         LEFT JOIN sellers s ON s.user_id = u.id
        WHERE rt.token_hash = $1
          AND rt.revoked_at IS NULL
          AND rt.expires_at > now()`,
      [hashRefreshToken(token)],
    );

    const user = rows[0];
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    return res.json({
      accessToken: signAccessToken(user),
      user: publicUser(user),
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (token) {
      await query(
        `UPDATE refresh_tokens
            SET revoked_at = now()
          WHERE token_hash = $1
            AND revoked_at IS NULL`,
        [hashRefreshToken(token)],
      );
    }

    clearRefreshCookie(res);
    return res.status(204).send();
  }),
);

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: req.query.role === 'seller' ? 'seller' : 'customer',
  })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Google OAuth is not configured' });
  }

  return passport.authenticate('google', { session: false }, async (error, user) => {
    if (error || !user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?oauth=failed`);
    }

    const refreshToken = generateRefreshToken();
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashRefreshToken(refreshToken), refreshExpiry()],
    );

    const sellerResult = await query(
      `SELECT s.id AS seller_id, s.subscription_status
         FROM sellers s
        WHERE s.user_id = $1`,
      [user.id],
    );
    const tokenUser = { ...user, ...sellerResult.rows[0] };
    setRefreshCookie(res, refreshToken);

    const accessToken = signAccessToken(tokenUser);
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth/callback?token=${encodeURIComponent(accessToken)}`,
    );
  })(req, res, next);
});

module.exports = router;
