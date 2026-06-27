const Joi = require('joi');
const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { auditLog } = require('../services/auditService');

const productSchema = Joi.object({
  name: Joi.string().min(2).max(160).required(),
  description: Joi.string().allow('').max(5000).default(''),
  price: Joi.number().precision(2).min(0).required(),
  stock: Joi.number().integer().min(0).default(0),
  images: Joi.array().items(Joi.string().uri()).default([]),
  category: Joi.string().allow('').max(120).default(''),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
});

const updateProductSchema = productSchema.fork(['name', 'price'], (field) => field.optional());

const settingsSchema = Joi.object({
  storeName: Joi.string().min(2).max(120).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(80).required(),
});

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const sellerId = req.user.sellerId;
    const [seller, totals, lowStock, tickets] = await Promise.all([
      req.db.query(
        `SELECT s.id, s.store_name, s.slug, s.subscription_status, s.verified_at,
                p.name AS plan_name
           FROM sellers s
           LEFT JOIN plans p ON p.id = s.plan_id
          WHERE s.id = $1`,
        [sellerId],
      ),
      req.db.query(
        `SELECT COUNT(DISTINCT p.id)::int AS products,
                COUNT(DISTINCT o.id)::int AS orders,
                COALESCE(SUM(CASE WHEN o.status IN ('paid', 'fulfilled') THEN o.total ELSE 0 END), 0)::numeric AS revenue
           FROM sellers s
           LEFT JOIN products p ON p.seller_id = s.id
           LEFT JOIN orders o ON o.seller_id = s.id
          WHERE s.id = $1`,
        [sellerId],
      ),
      req.db.query(
        `SELECT id, name, stock, low_stock_threshold
           FROM products
          WHERE seller_id = $1
            AND stock <= low_stock_threshold
          ORDER BY stock ASC
          LIMIT 10`,
        [sellerId],
      ),
      req.db.query(
        `SELECT COUNT(*)::int AS open_tickets
           FROM tickets
          WHERE seller_id = $1
            AND status IN ('open', 'pending')`,
        [sellerId],
      ),
    ]);

    res.json({
      seller: seller.rows[0],
      subscription: req.subscriptionAccess,
      metrics: {
        products: totals.rows[0]?.products || 0,
        orders: totals.rows[0]?.orders || 0,
        revenue: Number(totals.rows[0]?.revenue || 0),
        openTickets: tickets.rows[0]?.open_tickets || 0,
      },
      lowStock: lowStock.rows,
    });
  }),
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT id, name, description, price, stock, images, category, low_stock_threshold, created_at
         FROM products
        WHERE seller_id = $1
        ORDER BY created_at DESC`,
      [req.user.sellerId],
    );

    res.json(rows);
  }),
);

router.post(
  '/products',
  validate(productSchema),
  asyncHandler(async (req, res) => {
    const limit = await req.db.query(
      `SELECT p.max_products,
              (SELECT COUNT(*) FROM products WHERE seller_id = $1)::int AS product_count
         FROM sellers s
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE s.id = $1`,
      [req.user.sellerId],
    );

    const row = limit.rows[0];
    if (row?.max_products && row.product_count >= row.max_products) {
      return res.status(402).json({ message: 'Product limit reached for current plan' });
    }

    const { rows } = await req.db.query(
      `INSERT INTO products
        (seller_id, name, description, price, stock, images, category, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, price, stock, images, category, low_stock_threshold, created_at`,
      [
        req.user.sellerId,
        req.body.name,
        req.body.description,
        req.body.price,
        req.body.stock,
        req.body.images,
        req.body.category,
        req.body.lowStockThreshold,
      ],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'seller.product.create',
      resource: 'products',
      resourceId: rows[0].id,
    });

    return res.status(201).json(rows[0]);
  }),
);

router.put(
  '/products/:id',
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `UPDATE products
          SET name = COALESCE($3, name),
              description = COALESCE($4, description),
              price = COALESCE($5, price),
              stock = COALESCE($6, stock),
              images = COALESCE($7, images),
              category = COALESCE($8, category),
              low_stock_threshold = COALESCE($9, low_stock_threshold),
              updated_at = now()
        WHERE id = $1
          AND seller_id = $2
      RETURNING id, name, description, price, stock, images, category, low_stock_threshold, updated_at`,
      [
        req.params.id,
        req.user.sellerId,
        req.body.name,
        req.body.description,
        req.body.price,
        req.body.stock,
        req.body.images,
        req.body.category,
        req.body.lowStockThreshold,
      ],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'seller.product.update',
      resource: 'products',
      resourceId: rows[0].id,
    });

    return res.json(rows[0]);
  }),
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await req.db.query(
      `DELETE FROM products
        WHERE id = $1
          AND seller_id = $2`,
      [req.params.id, req.user.sellerId],
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'seller.product.delete',
      resource: 'products',
      resourceId: req.params.id,
    });

    return res.status(204).send();
  }),
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT o.id, o.total, o.status, o.created_at,
              u.email AS customer_email,
              COUNT(oi.id)::int AS item_count
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         JOIN users u ON u.id = c.user_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.seller_id = $1
        GROUP BY o.id, u.email
        ORDER BY o.created_at DESC`,
      [req.user.sellerId],
    );

    res.json(rows);
  }),
);

router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT c.id, c.address, c.created_at, u.email,
              COUNT(o.id)::int AS order_count,
              COALESCE(SUM(o.total), 0)::numeric AS lifetime_value
         FROM customers c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN orders o ON o.customer_id = c.id
        WHERE c.seller_id = $1
        GROUP BY c.id, u.email
        ORDER BY c.created_at DESC`,
      [req.user.sellerId],
    );

    res.json(rows);
  }),
);

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT id, store_name, slug, subscription_status, verified_at, created_at
         FROM sellers
        WHERE id = $1`,
      [req.user.sellerId],
    );

    res.json(rows[0]);
  }),
);

router.put(
  '/settings',
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `UPDATE sellers
          SET store_name = $2,
              slug = $3
        WHERE id = $1
      RETURNING id, store_name, slug, subscription_status, verified_at`,
      [req.user.sellerId, req.body.storeName, req.body.slug],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'seller.settings.update',
      resource: 'sellers',
      resourceId: req.user.sellerId,
    });

    res.json(rows[0]);
  }),
);

module.exports = router;
