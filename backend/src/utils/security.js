const crypto = require('crypto');

function verifyPaystackSignature(rawBody, signature) {
  if (!process.env.PAYSTACK_SECRET_KEY || !signature) return false;

  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  verifyPaystackSignature,
};
