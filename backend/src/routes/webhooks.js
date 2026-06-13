const router = require('express').Router();
const { query } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const { verifyPaystackSignature } = require('../utils/security');
const { sendEmail } = require('../services/emailService');

async function activateSubscription(event) {
  const metadata = event.data.metadata || {};
  const subscriptionCode = event.data.subscription?.subscription_code || event.data.subscription_code || null;
  const emailToken = event.data.subscription?.email_token || event.data.email_token || null;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await query(
    `UPDATE subscriptions
        SET status = 'active',
            paystack_subscription_code = COALESCE($4, paystack_subscription_code),
            paystack_email_token = COALESCE($5, paystack_email_token),
            expires_at = $3,
            updated_at = now()
      WHERE id = $1
         OR (seller_id = $2 AND plan_id = $6 AND status = 'pending')`,
    [
      metadata.subscriptionId || null,
      metadata.sellerId,
      expiresAt,
      subscriptionCode,
      emailToken,
      metadata.planId || null,
    ],
  );

  await query(
    `UPDATE sellers
        SET subscription_status = 'active',
            plan_id = $2
      WHERE id = $1`,
    [metadata.sellerId, metadata.planId],
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

async function expireSubscription(event) {
  const subscriptionCode = event.data.subscription_code || event.data.subscription?.subscription_code;
  if (!subscriptionCode) return;

  const { rows } = await query(
    `UPDATE subscriptions
        SET status = 'expired',
            updated_at = now()
      WHERE paystack_subscription_code = $1
      RETURNING seller_id`,
    [subscriptionCode],
  );

  if (rows[0]) {
    await query(
      `UPDATE sellers
          SET subscription_status = 'expired'
        WHERE id = $1`,
      [rows[0].seller_id],
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
      if (event.data.metadata?.type === 'subscription') {
        await activateSubscription(event);
      }
      if (event.data.metadata?.type === 'order') {
        await confirmOrder(event);
      }
    }

    if (event.event === 'subscription.create') {
      await activateSubscription(event);
    }

    if (event.event === 'subscription.disable' || event.event === 'invoice.payment_failed') {
      await expireSubscription(event);
    }

    return res.status(200).json({ received: true });
  }),
);

module.exports = router;
