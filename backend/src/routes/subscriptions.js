const Joi = require('joi');
const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { auditLog } = require('../services/auditService');
const { initializeTransaction, disableSubscription } = require('../services/paystackService');

const initializeSchema = Joi.object({
  planId: Joi.string().uuid().required(),
});

router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT sub.id, sub.status, sub.expires_at, sub.paystack_subscription_code,
              p.id AS plan_id, p.name AS plan_name, p.price, p.features
         FROM subscriptions sub
         JOIN plans p ON p.id = sub.plan_id
        WHERE sub.seller_id = $1
        ORDER BY sub.created_at DESC
        LIMIT 1`,
      [req.user.sellerId],
    );

    res.json(rows[0] || null);
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
    if (process.env.PAYSTACK_SECRET_KEY) {
      payment = await initializeTransaction({
        email: req.user.email,
        amount: Math.round(Number(plan.price) * 100),
        plan: plan.paystack_plan_code || undefined,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/seller/subscribe`,
        metadata: {
          type: 'subscription',
          sellerId: req.user.sellerId,
          planId: plan.id,
          subscriptionId: subscription.rows[0].id,
        },
      });
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'subscription.initialize',
      resource: 'subscriptions',
      resourceId: subscription.rows[0].id,
      metadata: { planId: plan.id },
    });

    return res.status(201).json({
      subscription: subscription.rows[0],
      payment,
    });
  }),
);

router.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT id, paystack_subscription_code, paystack_email_token
         FROM subscriptions
        WHERE seller_id = $1
          AND status IN ('active', 'trialing')
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.user.sellerId],
    );

    const subscription = rows[0];
    if (!subscription) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }

    if (
      process.env.PAYSTACK_SECRET_KEY &&
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
          SET subscription_status = 'expired'
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
