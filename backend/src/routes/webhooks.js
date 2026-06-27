const router = require('express').Router();
const { query } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { verifyPaystackSignature } = require('../utils/security');
const { sendEmail } = require('../services/emailService');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanUuid(value) {
  const text = String(value || '');
  return uuidPattern.test(text) ? text : null;
}

function subscriptionCode(data) {
  return data.subscription?.subscription_code || data.subscription_code || null;
}

function emailToken(data) {
  return data.subscription?.email_token || data.email_token || null;
}

function renewalExpiry(data) {
  const candidates = [
    data.subscription?.next_payment_date,
    data.next_payment_date,
    data.next_payment_at,
    data.paid_at,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime()) && parsed > new Date()) {
      return parsed;
    }
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback;
}

async function activateSubscription(event) {
  const metadata = event.data.metadata || {};
  const code = subscriptionCode(event.data);
  const token = emailToken(event.data);
  const expiresAt = renewalExpiry(event.data);
  const metadataSubscriptionId = cleanUuid(metadata.subscriptionId);
  let sellerId = cleanUuid(metadata.sellerId);
  let planId = cleanUuid(metadata.planId);

  if ((!sellerId || !planId) && code) {
    const existing = await query(
      `SELECT seller_id, plan_id
         FROM subscriptions
        WHERE paystack_subscription_code = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [code],
    );
    sellerId = sellerId || existing.rows[0]?.seller_id || null;
    planId = planId || existing.rows[0]?.plan_id || null;
  }

  if (!sellerId || !planId) return;

  await query(
    `UPDATE subscriptions
        SET status = 'active',
            paystack_subscription_code = COALESCE($4, paystack_subscription_code),
            paystack_email_token = COALESCE($5, paystack_email_token),
            expires_at = $3,
            updated_at = now()
      WHERE id = $1
         OR ($4::text IS NOT NULL AND paystack_subscription_code = $4)
         OR (seller_id = $2 AND plan_id = $6 AND status = 'pending')`,
    [
      metadataSubscriptionId,
      sellerId,
      expiresAt,
      code,
      token,
      planId,
    ],
  );

  await query(
    `UPDATE sellers
        SET subscription_status = 'active',
            plan_id = $2
      WHERE id = $1`,
    [sellerId, planId],
  );
}

async function confirmOrder(event) {
  const metadata = event.data.metadata || {};
  const orderId = metadata.orderId;
  if (!orderId) return;

  const order = await query(
    `UPDATE orders
        SET status = 'paid',
            payment_reference = COALESCE(payment_reference, $2),
            updated_at = now()
      WHERE id = $1
      RETURNING id, seller_id, customer_id, total`,
    [orderId, event.data.reference],
  );

  if (!order.rows[0]) return;

  await query(
    `UPDATE products p
        SET stock = GREATEST(p.stock - oi.quantity, 0),
            updated_at = now()
       FROM order_items oi
      WHERE oi.order_id = $1
        AND oi.product_id = p.id`,
    [orderId],
  );

  const customer = await query(
    `SELECT u.email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN users u ON u.id = c.user_id
      WHERE o.id = $1`,
    [orderId],
  );

  if (customer.rows[0]?.email) {
    await sendEmail({
      to: customer.rows[0].email,
      subject: 'Order confirmed',
      text: `Your order ${orderId} has been confirmed.`,
    });
  }
}

async function closeSubscription(event, status) {
  const code = subscriptionCode(event.data);
  if (!code) return;

  const { rows } = await query(
    `UPDATE subscriptions
        SET status = $2,
            updated_at = now()
      WHERE paystack_subscription_code = $1
      RETURNING seller_id`,
    [code, status],
  );

  if (rows[0]) {
    await query(
      `UPDATE sellers
          SET subscription_status = $2,
              updated_at = now()
        WHERE id = $1`,
      [rows[0].seller_id, status],
    );
  }
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-paystack-signature'];

    if (!verifyPaystackSignature(rawBody, signature)) {
      return res.status(401).json({ message: 'Invalid Paystack signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    if (event.event === 'charge.success') {
      if (event.data.metadata?.type === 'subscription' || subscriptionCode(event.data)) {
        await activateSubscription(event);
      }
      if (event.data.metadata?.type === 'order') {
        await confirmOrder(event);
      }
    }

    if (event.event === 'subscription.create') {
      await activateSubscription(event);
    }

    if (event.event === 'subscription.disable') {
      await closeSubscription(event, 'cancelled');
    }

    if (event.event === 'invoice.payment_failed') {
      await closeSubscription(event, 'expired');
    }

    return res.status(200).json({ received: true });
  }),
);

module.exports = router;
