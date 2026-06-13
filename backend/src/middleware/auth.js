const { verifyAccessToken } = require('../utils/tokens');

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function authenticateToken(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

function optionalToken(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) return next();

  try {
    req.user = verifyAccessToken(token);
  } catch (_error) {
    req.user = null;
  }

  return next();
}

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.optionalToken = optionalToken;
