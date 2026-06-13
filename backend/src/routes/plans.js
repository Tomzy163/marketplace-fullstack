const router = require('express').Router();
const { query } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, price, max_products, max_orders_per_month, features
         FROM plans
        WHERE is_active = true
        ORDER BY price ASC`,
    );

    res.json(rows);
  }),
);

module.exports = router;
