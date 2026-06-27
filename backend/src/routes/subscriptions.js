const Joi = require('joi');
const router = require('express').Router();
const { env } = require('../config/env');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { auditLog } = require('../services/auditService');
const {
  currentSubscription,
  syncSellerAccess,
} = require('../services/subscriptionService');
const { initializeTransaction, disableSubscription } = require('../services/paystackService');

const initializeSchema = Joi.object({
  planId: Joi.string().uuid().required(),
});

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const current = await currentSubscription(req.db, req.user.sellerId, req.user);

    res.json({
      ...(current.subscription || {}),
      access: current.access,
      subscription: current.subscription,
    });
  }),
);

router.post(
  '/initialize',
  validate(initializeSchema),
  asyncHandler(async (req, res) => {
    const planResult = await req.db.query(
      `SELECT id, name, price, paystack_plan_code
         FROM plans
        WHERE id = $1
          AND is_active = true`,
      [req.body.planId],
    );

    const plan = planResult.rows[0];
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const subscription = await req.db.query(
      `INSERT INTO subscriptions (seller_id, plan_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, status`,
      [req.user.sellerId, plan.id],
    );

    let payment = null;
    let activatedLocally = false;

    if (!env.PAYSTACK_SECRET_KEY && env.isProduction && Number(plan.price) > 0) {
      return res.status(503).json({ message: 'Payment provider is not configured' });
    }

    if (env.PAYSTACK_SECRET_KEY && Number(plan.price) > 0) {
      const payload = {
        email: req.user.email,
        amount: Math.round(Number(plan.price) * 100),
        currency: env.PAYSTACK_CURRENCY,
        plan: plan.paystack_plan_code || undefined,
        callback_url: `${env.FRONTEND_URL}/seller/subscribe`,
        metadata: {
          type: 'subscription',
          sellerId: req.user.sellerId,
          planId: plan.id,
          subscriptionId: subscription.rows[0].id,
        },
      };

      if (env.PAYSTACK_SPLIT_CODE) {
        payload.split_code = env.PAYSTACK_SPLIT_CODE;
      }

      payment = await initializeTransaction({
        ...payload,
      });
    }

    if (!payment && (!env.isProduction || Number(plan.price) === 0)) {
      activatedLocally = true;
      await req.db.query(
        `UPDATE subscriptions
            SET status = 'active',
                expires_at = now() + interval '30 days',
                updated_at = now()
          WHERE id = $1`,
        [subscription.rows[0].id],
      );
      await req.db.query(
        `UPDATE sellers
            SET subscription_status = 'active',
                plan_id = $2,
                updated_at = now()
          WHERE id = $1`,
        [req.user.sellerId, plan.id],
      );
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'subscription.initialize',
      resource: 'subscriptions',
      resourceId: subscription.rows[0].id,
      metadata: { planId: plan.id, activatedLocally },
    });

    const access = await syncSellerAccess(req.db, req.user.sellerId, req.user);

    return res.status(201).json({
      subscription: {
        ...subscription.rows[0],
        status: activatedLocally ? 'active' : subscription.rows[0].status,
      },
      payment,
      access,
    });
  }),
);

router.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT id, status, paystack_subscription_code, paystack_email_token
         FROM subscriptions
        WHERE seller_id = $1
          AND status IN ('active', 'trialing', 'admin_override')
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.user.sellerId],
    );

    const subscription = rows[0];
    if (!subscription) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }

    if (subscription.status === 'admin_override') {
      return res.status(403).json({ message: 'Administrative premium access is managed by platform configuration' });
    }

    if (
      env.PAYSTACK_SECRET_KEY &&
      subscription.paystack_subscription_code &&
      subscription.paystack_email_token
    ) {
      await disableSubscription(
        subscription.paystack_subscription_code,
        subscription.paystack_email_token,
      );
    }

    await req.db.query(
      `UPDATE subscriptions
          SET status = 'cancelled',
              updated_at = now()
        WHERE id = $1`,
      [subscription.id],
    );
    await req.db.query(
      `UPDATE sellers
          SET subscription_status = 'cancelled',
              updated_at = now()
        WHERE id = $1`,
      [req.user.sellerId],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'subscription.cancel',
      resource: 'subscriptions',
      resourceId: subscription.id,
    });

    return res.status(204).send();
  }),
);

module.exports = router;
