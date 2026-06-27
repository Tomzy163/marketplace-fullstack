const { env } = require('../config/env');
const { isAdminPremiumUser } = require('./adminOverrideService');

const ACCESS_STATUSES = new Set(['active', 'trialing', 'admin_override']);

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function hasSellerAccess(status, expiresAt) {
  if (!ACCESS_STATUSES.has(status)) return false;
  if (status === 'admin_override') return true;
  return !expiresAt || new Date(expiresAt) > new Date();
}

function accessSource(status) {
  if (status === 'admin_override') return 'admin_override';
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'paid';
  return 'none';
}

function buildAccess(row = {}) {
  const status = row.subscription_status || row.status || 'pending';
  const expiresAt = row.subscription_expires_at || row.expires_at || null;

  return {
    hasAccess: hasSellerAccess(status, expiresAt),
    subscriptionStatus: status,
    subscriptionExpiresAt: expiresAt,
    accessSource: accessSource(status),
    trialDaysRemaining: status === 'trialing' ? daysRemaining(expiresAt) : null,
    plan: row.plan_id
      ? {
          id: row.plan_id,
          name: row.plan_name || null,
          price: row.plan_price === undefined ? null : Number(row.plan_price),
          maxProducts: row.max_products,
          maxOrdersPerMonth: row.max_orders_per_month,
          features: row.features || [],
        }
      : null,
    subscriptionId: row.subscription_id || row.id || null,
  };
}

async function findPlan(db, preferredName) {
  const name = String(preferredName || '').trim();
  const { rows } = await db.query(
    `SELECT id, name, price, max_products, max_orders_per_month, features
       FROM plans
      WHERE is_active = true
      ORDER BY
        CASE WHEN $1::text <> '' AND lower(name) = lower($1) THEN 0 ELSE 1 END,
        price DESC,
        created_at ASC
      LIMIT 1`,
    [name],
  );

  return rows[0] || null;
}

async function applyAdminPremiumAccess(db, seller, planName = env.ADMIN_PREMIUM_PLAN_NAME) {
  const plan = await findPlan(db, planName);
  if (!plan) return null;

  const subscription = await db.query(
    `INSERT INTO subscriptions (seller_id, plan_id, status, expires_at)
     SELECT $1, $2, 'admin_override', NULL
      WHERE NOT EXISTS (
        SELECT 1
          FROM subscriptions
         WHERE seller_id = $1
           AND status = 'admin_override'
      )
     RETURNING id, status, expires_at`,
    [seller.seller_id || seller.id, plan.id],
  );

  const existing = subscription.rows[0]
    ? subscription.rows[0]
    : (
        await db.query(
          `SELECT id, status, expires_at
             FROM subscriptions
            WHERE seller_id = $1
              AND status = 'admin_override'
            ORDER BY created_at DESC
            LIMIT 1`,
          [seller.seller_id || seller.id],
        )
      ).rows[0];

  await db.query(
    `UPDATE sellers
        SET subscription_status = 'admin_override',
            plan_id = $2,
            updated_at = now()
      WHERE id = $1`,
    [seller.seller_id || seller.id, plan.id],
  );

  return buildAccess({
    subscription_id: existing?.id || null,
    subscription_status: 'admin_override',
    subscription_expires_at: null,
    plan_id: plan.id,
    plan_name: plan.name,
    plan_price: plan.price,
    max_products: plan.max_products,
    max_orders_per_month: plan.max_orders_per_month,
    features: plan.features,
  });
}

async function grantInitialSellerAccess(db, seller) {
  if (isAdminPremiumUser(seller)) {
    const overrideAccess = await applyAdminPremiumAccess(db, seller);
    if (overrideAccess) return overrideAccess;
  }

  if (!env.TRIAL_ENABLED) {
    return buildAccess({ subscription_status: 'pending' });
  }

  const plan = await findPlan(db, env.TRIAL_PLAN_NAME);
  if (!plan) {
    await db.query(
      `UPDATE sellers
          SET subscription_status = 'trialing',
              updated_at = now()
        WHERE id = $1`,
      [seller.seller_id || seller.id],
    );

    return buildAccess({
      subscription_status: 'trialing',
      subscription_expires_at: addDays(new Date(), env.TRIAL_DAYS),
    });
  }

  const { rows } = await db.query(
    `INSERT INTO subscriptions (seller_id, plan_id, status, expires_at)
     VALUES ($1, $2, 'trialing', now() + ($3::int * interval '1 day'))
     RETURNING id, status, expires_at`,
    [seller.seller_id || seller.id, plan.id, env.TRIAL_DAYS],
  );

  await db.query(
    `UPDATE sellers
        SET subscription_status = 'trialing',
            plan_id = $2,
            updated_at = now()
      WHERE id = $1`,
    [seller.seller_id || seller.id, plan.id],
  );

  return buildAccess({
    subscription_id: rows[0].id,
    subscription_status: rows[0].status,
    subscription_expires_at: rows[0].expires_at,
    plan_id: plan.id,
    plan_name: plan.name,
    plan_price: plan.price,
    max_products: plan.max_products,
    max_orders_per_month: plan.max_orders_per_month,
    features: plan.features,
  });
}

async function syncSellerAccess(db, sellerId, user = {}) {
  if (!sellerId) return buildAccess({ subscription_status: null });

  const sellerResult = await db.query(
    `SELECT s.id AS seller_id, s.subscription_status, s.plan_id,
            u.id AS user_id, u.email
       FROM sellers s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [sellerId],
  );

  const seller = sellerResult.rows[0];
  if (!seller) return buildAccess({ subscription_status: null });

  const principal = {
    id: user.id || user.user_id || seller.user_id,
    email: user.email || seller.email,
    seller_id: seller.seller_id,
  };

  if (isAdminPremiumUser(principal)) {
    const overrideAccess = await applyAdminPremiumAccess(db, seller);
    if (overrideAccess) return overrideAccess;
  } else {
    await db.query(
      `UPDATE subscriptions
          SET status = 'expired',
              updated_at = now()
        WHERE seller_id = $1
          AND status = 'admin_override'`,
      [sellerId],
    );
  }

  await db.query(
    `UPDATE subscriptions
        SET status = 'expired',
            updated_at = now()
      WHERE seller_id = $1
        AND status IN ('active', 'trialing')
        AND expires_at IS NOT NULL
        AND expires_at <= now()`,
    [sellerId],
  );

  const activeResult = await db.query(
    `SELECT sub.id AS subscription_id, sub.status AS subscription_status,
            sub.expires_at AS subscription_expires_at,
            p.id AS plan_id, p.name AS plan_name, p.price AS plan_price,
            p.max_products, p.max_orders_per_month, p.features
       FROM subscriptions sub
       JOIN plans p ON p.id = sub.plan_id
      WHERE sub.seller_id = $1
        AND sub.status IN ('active', 'trialing')
        AND (sub.expires_at IS NULL OR sub.expires_at > now())
      ORDER BY
        CASE sub.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END,
        sub.expires_at DESC NULLS FIRST,
        sub.created_at DESC
      LIMIT 1`,
    [sellerId],
  );

  const active = activeResult.rows[0];
  if (active) {
    await db.query(
      `UPDATE sellers
          SET subscription_status = $2,
              plan_id = $3,
              updated_at = now()
        WHERE id = $1`,
      [sellerId, active.subscription_status, active.plan_id],
    );

    return buildAccess(active);
  }

  const shouldExpireSeller = ACCESS_STATUSES.has(seller.subscription_status);
  const nextStatus = shouldExpireSeller
    ? (seller.subscription_status === 'cancelled' ? 'cancelled' : 'expired')
    : seller.subscription_status;
  await db.query(
    `UPDATE sellers
        SET subscription_status = CASE
              WHEN subscription_status IN ('active', 'trialing', 'admin_override') THEN $2
              ELSE subscription_status
            END,
            updated_at = now()
      WHERE id = $1`,
    [sellerId, nextStatus],
  );

  const latest = await db.query(
    `SELECT sub.id AS subscription_id, sub.status AS subscription_status,
            sub.expires_at AS subscription_expires_at,
            p.id AS plan_id, p.name AS plan_name, p.price AS plan_price,
            p.max_products, p.max_orders_per_month, p.features
       FROM subscriptions sub
       LEFT JOIN plans p ON p.id = sub.plan_id
      WHERE sub.seller_id = $1
      ORDER BY sub.created_at DESC
      LIMIT 1`,
    [sellerId],
  );

  return buildAccess(latest.rows[0] || { subscription_status: nextStatus });
}

async function currentSubscription(db, sellerId, user = {}) {
  const access = await syncSellerAccess(db, sellerId, user);
  const { rows } = await db.query(
    `SELECT sub.id, sub.status, sub.expires_at, sub.paystack_subscription_code,
            p.id AS plan_id, p.name AS plan_name, p.price, p.features,
            p.max_products, p.max_orders_per_month
       FROM subscriptions sub
       LEFT JOIN plans p ON p.id = sub.plan_id
      WHERE sub.seller_id = $1
      ORDER BY
        CASE sub.status WHEN 'admin_override' THEN 0 WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 ELSE 3 END,
        sub.created_at DESC
      LIMIT 1`,
    [sellerId],
  );

  return {
    access,
    subscription: rows[0] || null,
  };
}

module.exports = {
  ACCESS_STATUSES,
  addDays,
  buildAccess,
  currentSubscription,
  findPlan,
  grantInitialSellerAccess,
  hasSellerAccess,
  syncSellerAccess,
};
