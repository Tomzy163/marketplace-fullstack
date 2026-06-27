const crypto = require('crypto');
const { env } = require('../config/env');

function verifyPaystackSignature(rawBody, signature) {
  if (!env.PAYSTACK_SECRET_KEY || !signature || !/^[a-f0-9]+$/i.test(String(signature))) {
    return false;
  }

  const expected = Buffer.from(
    crypto
      .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
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
