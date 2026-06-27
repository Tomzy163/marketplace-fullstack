const Joi = require('joi');
const router = require('express').Router();
const { getClient, setTenantContext } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { optionalToken } = require('../middleware/auth');
const { initializeTransaction } = require('../services/paystackService');

const checkoutSchema = Joi.object({
  customer: Joi.object({
    email: Joi.string().email().required(),
    address: Joi.string().allow('').max(1000).default(''),
  }).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

async function withStorefrontTenant(slug, handler) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const sellerResult = await client.query(
      `SELECT id, store_name, slug, subscription_status, verified_at
         FROM sellers
        WHERE slug = $1
          AND (
            subscription_status IN ('active', 'admin_override')
            OR (
              subscription_status = 'trialing'
              AND EXISTS (
                SELECT 1
                  FROM subscriptions sub
                 WHERE sub.seller_id = sellers.id
                   AND sub.status = 'trialing'
                   AND sub.expires_at > now()
              )
            )
          )`,
      [slug],
    );

    const seller = sellerResult.rows[0];
    if (!seller) {
      await client.query('ROLLBACK');
      return { status: 404, body: { message: 'Storefront not found or inactive' } };
    }

    await setTenantContext(client, {
      sellerId: seller.id,
      role: 'storefront',
    });

    const result = await handler(client, seller);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const result = await withStorefrontTenant(req.params.slug, async (_db, seller) => ({
      status: 200,
      body: { seller },
    }));

    res.status(result.status).json(result.body);
  }),
);

router.get(
  '/:slug/products',
  asyncHandler(async (req, res) => {
    const result = await withStorefrontTenant(req.params.slug, async (db, seller) => {
      const { rows } = await db.query(
        `SELECT id, name, description, price, stock, images, category, created_at
           FROM products
          WHERE seller_id = $1
            AND stock > 0
          ORDER BY created_at DESC`,
        [seller.id],
      );

      return { status: 200, body: rows };
    });

    res.status(result.status).json(result.body);
  }),
);

router.get(
  '/:slug/products/:id',
  asyncHandler(async (req, res) => {
    const result = await withStorefrontTenant(req.params.slug, async (db, seller) => {
      const { rows } = await db.query(
        `SELECT id, name, description, price, stock, images, category, created_at
           FROM products
          WHERE id = $1
            AND seller_id = $2`,
        [req.params.id, seller.id],
      );

      if (!rows[0]) {
        return { status: 404, body: { message: 'Product not found' } };
      }

      return { status: 200, body: rows[0] };
    });

    res.status(result.status).json(result.body);
  }),
);

router.post(
  '/:slug/orders/checkout',
  optionalToken,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const result = await withStorefrontTenant(req.params.slug, async (db, seller) => {
      const productIds = req.body.items.map((item) => item.productId);
      const { rows: products } = await db.query(
        `SELECT id, name, price, stock
           FROM products
          WHERE seller_id = $1
            AND id = ANY($2::uuid[])`,
        [seller.id, productIds],
      );

      if (products.length !== productIds.length) {
        return { status: 422, body: { message: 'One or more products are unavailable' } };
      }

      const productMap = new Map(products.map((product) => [product.id, product]));
      let total = 0;
      for (const item of req.body.items) {
        const product = productMap.get(item.productId);
        if (product.stock < item.quantity) {
          return { status: 422, body: { message: `${product.name} is out of stock` } };
        }
        total += Number(product.price) * item.quantity;
      }

      let userId = req.user?.id || null;
      if (!userId) {
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [
          req.body.customer.email.toLowerCase(),
        ]);

        if (existing.rows[0]) {
          userId = existing.rows[0].id;
        } else {
          const created = await db.query(
            `INSERT INTO users (email, role)
             VALUES ($1, 'customer')
             RETURNING id`,
            [req.body.customer.email.toLowerCase()],
          );
          userId = created.rows[0].id;
        }
      }

      const customer = await db.query(
        `INSERT INTO customers (seller_id, user_id, address)
         VALUES ($1, $2, $3)
         ON CONFLICT (seller_id, user_id)
         DO UPDATE SET address = EXCLUDED.address
         RETURNING id`,
        [seller.id, userId, req.body.customer.address],
      );

      const order = await db.query(
        `INSERT INTO orders (seller_id, customer_id, total, status)
         VALUES ($1, $2, $3, 'payment_pending')
         RETURNING id, total, status`,
        [seller.id, customer.rows[0].id, total],
      );

      for (const item of req.body.items) {
        const product = productMap.get(item.productId);
        await db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [order.rows[0].id, item.productId, item.quantity, product.price],
        );
      }

      let payment = null;
      if (process.env.PAYSTACK_SECRET_KEY) {
        payment = await initializeTransaction({
          email: req.body.customer.email,
          amount: Math.round(total * 100),
          callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/store/${seller.slug}/checkout`,
          metadata: {
            type: 'order',
            orderId: order.rows[0].id,
            sellerId: seller.id,
          },
        });

        await db.query(
          `UPDATE orders
              SET payment_reference = $2
            WHERE id = $1`,
          [order.rows[0].id, payment.reference],
        );
      }

      return {
        status: 201,
        body: {
          order: order.rows[0],
          payment,
        },
      };
    });

    res.status(result.status).json(result.body);
  }),
);

module.exports = router;
