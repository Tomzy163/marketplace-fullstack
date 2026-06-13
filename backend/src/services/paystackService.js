const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function paystackClient() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }

  return axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

async function initializeTransaction(payload) {
  const { data } = await paystackClient().post('/transaction/initialize', payload);
  return data.data;
}

async function createPlan(payload) {
  const { data } = await paystackClient().post('/plan', payload);
  return data.data;
}

async function disableSubscription(code, token) {
  const { data } = await paystackClient().post('/subscription/disable', {
    code,
    token,
  });
  return data.data;
}

module.exports = {
  initializeTransaction,
  createPlan,
  disableSubscription,
};
