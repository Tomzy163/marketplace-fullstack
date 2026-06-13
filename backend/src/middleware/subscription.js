async function checkSubscription(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'super_admin') {
    return next();
  }

  if (req.user.role !== 'seller') {
    return next();
  }

  if (!req.user.sellerId) {
    return res.status(403).json({ message: 'Seller profile required' });
  }

  const db = req.db;
  const { rows } = await db.query(
    `SELECT s.subscription_status, sub.expires_at
       FROM sellers s
       LEFT JOIN subscriptions sub
         ON sub.seller_id = s.id
        AND sub.status IN ('active', 'trialing')
      WHERE s.id = $1
      ORDER BY sub.expires_at DESC NULLS LAST
      LIMIT 1`,
    [req.user.sellerId],
  );

  const seller = rows[0];
  const expiresAt = seller?.expires_at ? new Date(seller.expires_at) : null;
  const active = seller?.subscription_status === 'active' && (!expiresAt || expiresAt > new Date());

  if (!active) {
    return res.status(402).json({ message: 'Active subscription required' });
  }

  return next();
}

module.exports = checkSubscription;
