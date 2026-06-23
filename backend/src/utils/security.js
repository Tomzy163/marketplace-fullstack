const crypto = require('crypto');

function verifyPaystackSignature(rawBody, signature) {
  if (!process.env.PAYSTACK_SECRET_KEY || !signature) return false;

  const expected = Buffer.from(
    crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex'),
    'hex',
  );
  const received = Buffer.from(String(signature), 'hex');

  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

module.exports = {
  verifyPaystackSignature,
};
