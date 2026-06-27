const { syncSellerAccess } = require('../services/subscriptionService');

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

  const access = await syncSellerAccess(req.db, req.user.sellerId, req.user);
  req.subscriptionAccess = access;
  req.user.subscriptionStatus = access.subscriptionStatus;

  if (!access.hasAccess) {
    return res.status(402).json({
      message: 'Active subscription or trial required',
      subscriptionStatus: access.subscriptionStatus,
      subscriptionExpiresAt: access.subscriptionExpiresAt,
      accessSource: access.accessSource,
    });
  }

  return next();
}

module.exports = checkSubscription;
