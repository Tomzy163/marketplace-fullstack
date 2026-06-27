const { env } = require('../config/env');

function isAdminPremiumUser(user = {}) {
  if (!env.ADMIN_PREMIUM_OVERRIDE_ENABLED) return false;

  const email = String(user.email || '').trim().toLowerCase();
  const userId = String(user.id || user.user_id || user.userId || '').trim();

  return (
    (email && env.adminPremiumEmails.includes(email)) ||
    (userId && env.adminPremiumUserIds.includes(userId))
  );
}

function adminOverrideSummary() {
  return {
    enabled: env.ADMIN_PREMIUM_OVERRIDE_ENABLED,
    planName: env.ADMIN_PREMIUM_PLAN_NAME,
    privilegedEmails: env.adminPremiumEmails,
    privilegedUserIds: env.adminPremiumUserIds,
  };
}

module.exports = {
  isAdminPremiumUser,
  adminOverrideSummary,
};
