function checkRole(...roles) {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
  };
}

module.exports = checkRole;
module.exports.checkRole = checkRole;
