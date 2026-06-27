const Joi = require('joi');
const router = require('express').Router();
const { env } = require('../config/env');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { auditLog } = require('../services/auditService');
const { adminOverrideSummary } = require('../services/adminOverrideService');

const sellerStatusSchema = Joi.object({
  subscriptionStatus: Joi.string().valid('pending', 'trialing', 'active', 'expired', 'cancelled').optional(),
  verified: Joi.boolean().optional(),
}).or('subscriptionStatus', 'verified');

const planSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  price: Joi.number().precision(2).min(0).required(),
  maxProducts: Joi.number().integer().min(0).allow(null).default(null),
  maxOrdersPerMonth: Joi.number().integer().min(0).allow(null).default(null),
  features: Joi.array().items(Joi.string()).default([]),
  paystackPlanCode: Joi.string().allow('', null).default(null),
  isActive: Joi.boolean().default(true),
});

const assignmentSchema = Joi.object({
  agentId: Joi.string().uuid().required(),
  sellerId: Joi.string().uuid().required(),
});

router.get(
  '/sellers',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT s.id, s.store_name, s.slug, s.subscription_status, s.verified_at, s.created_at,
              u.email AS owner_email,
              u.id AS owner_id,
              p.name AS plan_name,
              latest.status AS latest_subscription_status,
              latest.expires_at AS subscription_expires_at
         FROM sellers s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN plans p ON p.id = s.plan_id
         LEFT JOIN LATERAL (
           SELECT status, expires_at
             FROM subscriptions sub
            WHERE sub.seller_id = s.id
            ORDER BY created_at DESC
            LIMIT 1
         ) latest ON true
        ORDER BY s.created_at DESC`,
    );

    res.json(rows);
  }),
);

router.patch(
  '/sellers/:id/status',
  validate(sellerStatusSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `UPDATE sellers
          SET subscription_status = COALESCE($2, subscription_status),
              verified_at = CASE
                WHEN $3::boolean IS TRUE THEN COALESCE(verified_at, now())
                WHEN $3::boolean IS FALSE THEN NULL
                ELSE verified_at
              END
        WHERE id = $1
      RETURNING id, store_name, slug, subscription_status, verified_at`,
      [req.params.id, req.body.subscriptionStatus || null, req.body.verified],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'admin.seller.status.update',
      resource: 'sellers',
      resourceId: req.params.id,
      metadata: req.body,
    });

    return res.json(rows[0]);
  }),
);

router.get(
  '/subscriptions',
  asyncHandler(async (_req, res) => {
    const { rows } = await _req.db.query(
      `SELECT sub.id, sub.status, sub.expires_at, sub.created_at,
              s.store_name,
              p.name AS plan_name,
              p.price
         FROM subscriptions sub
         JOIN sellers s ON s.id = sub.seller_id
         JOIN plans p ON p.id = sub.plan_id
        ORDER BY sub.created_at DESC`,
    );

    res.json(rows);
  }),
);

router.get(
  '/system-config',
  asyncHandler(async (_req, res) => {
    res.json({
      appName: env.APP_NAME,
      frontendUrl: env.FRONTEND_URL,
      allowedOrigins: env.allowedOrigins,
      trial: {
        enabled: env.TRIAL_ENABLED,
        days: env.TRIAL_DAYS,
        planName: env.TRIAL_PLAN_NAME,
      },
      adminPremiumOverride: adminOverrideSummary(),
      security: {
        accessTokenTtl: env.ACCESS_TOKEN_TTL,
        refreshTokenDays: env.REFRESH_TOKEN_DAYS,
        refreshCookieName: env.REFRESH_COOKIE_NAME,
        refreshCookieSameSite: env.REFRESH_COOKIE_SAMESITE,
        refreshCookieSecure: env.REFRESH_COOKIE_SECURE,
        authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
        apiRateLimitMax: env.API_RATE_LIMIT_MAX,
        trustProxy: env.TRUST_PROXY,
      },
      providers: {
        paystackConfigured: Boolean(env.PAYSTACK_SECRET_KEY),
        googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        sendgridConfigured: Boolean(env.SENDGRID_API_KEY),
        smtpConfigured: Boolean(env.SMTP_HOST),
        cloudinaryConfigured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY),
      },
    });
  }),
);

router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT id, name, price, max_products, max_orders_per_month, features,
              paystack_plan_code, is_active, created_at
         FROM plans
        ORDER BY price ASC`,
    );

    res.json(rows);
  }),
);

router.post(
  '/plans',
  validate(planSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `INSERT INTO plans
        (name, price, max_products, max_orders_per_month, features, paystack_plan_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, price, max_products, max_orders_per_month, features, paystack_plan_code, is_active`,
      [
        req.body.name,
        req.body.price,
        req.body.maxProducts,
        req.body.maxOrdersPerMonth,
        req.body.features,
        req.body.paystackPlanCode || null,
        req.body.isActive,
      ],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'admin.plan.create',
      resource: 'plans',
      resourceId: rows[0].id,
    });

    res.status(201).json(rows[0]);
  }),
);

router.post(
  '/agent-assignments',
  validate(assignmentSchema),
  asyncHandler(async (req, res) => {
    const agent = await req.db.query(
      `SELECT id
         FROM users
        WHERE id = $1
          AND role = 'support_agent'`,
      [req.body.agentId],
    );

    if (!agent.rows[0]) {
      return res.status(422).json({ message: 'User is not a support agent' });
    }

    const { rows } = await req.db.query(
      `INSERT INTO agent_assignments (agent_id, seller_id)
       VALUES ($1, $2)
       ON CONFLICT (agent_id, seller_id) DO NOTHING
       RETURNING id, agent_id, seller_id`,
      [req.body.agentId, req.body.sellerId],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'admin.agent.assign',
      resource: 'agent_assignments',
      resourceId: rows[0]?.id || null,
      metadata: req.body,
    });

    return res.status(201).json(rows[0] || req.body);
  }),
);

router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT al.id, al.action, al.resource, al.resource_id, al.metadata, al.created_at,
              u.email AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 200`,
    );

    res.json(rows);
  }),
);

module.exports = router;
