const Joi = require('joi');
const router = require('express').Router();
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { checkRole } = require('../middleware/role');
const { setTenantContext } = require('../config/db');
const { auditLog } = require('../services/auditService');

const createTicketSchema = Joi.object({
  sellerSlug: Joi.string().required(),
  subject: Joi.string().min(3).max(180).required(),
  message: Joi.string().min(1).max(5000).required(),
});

const messageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required(),
});

const statusSchema = Joi.object({
  status: Joi.string().valid('open', 'pending', 'resolved', 'closed').required(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at,
              s.store_name,
              cu.email AS customer_email,
              au.email AS agent_email
         FROM tickets t
         JOIN sellers s ON s.id = t.seller_id
         JOIN customers c ON c.id = t.customer_id
         JOIN users cu ON cu.id = c.user_id
         LEFT JOIN users au ON au.id = t.agent_id
        WHERE ($1::text <> 'customer' OR c.user_id = $2)
        ORDER BY t.updated_at DESC`,
      [req.user.role, req.user.id],
    );

    res.json(rows);
  }),
);

router.post(
  '/',
  validate(createTicketSchema),
  asyncHandler(async (req, res) => {
    const sellerResult = await req.db.query(
      `SELECT id
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
      [req.body.sellerSlug],
    );

    const seller = sellerResult.rows[0];
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found or inactive' });
    }

    await setTenantContext(req.db, {
      userId: req.user.id,
      sellerId: seller.id,
      role: req.user.role,
    });

    const customer = await req.db.query(
      `INSERT INTO customers (seller_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (seller_id, user_id)
       DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING id`,
      [seller.id, req.user.id],
    );

    const ticket = await req.db.query(
      `INSERT INTO tickets (seller_id, customer_id, subject, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, seller_id, customer_id, subject, status, created_at`,
      [seller.id, customer.rows[0].id, req.body.subject],
    );

    await req.db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)`,
      [ticket.rows[0].id, req.user.id, req.body.message],
    );

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'ticket.create',
      resource: 'tickets',
      resourceId: ticket.rows[0].id,
    });

    return res.status(201).json(ticket.rows[0]);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ticket = await req.db.query(
      `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at,
              s.store_name,
              cu.email AS customer_email,
              au.email AS agent_email
         FROM tickets t
         JOIN sellers s ON s.id = t.seller_id
         JOIN customers c ON c.id = t.customer_id
         JOIN users cu ON cu.id = c.user_id
         LEFT JOIN users au ON au.id = t.agent_id
        WHERE t.id = $1
          AND ($2::text <> 'customer' OR c.user_id = $3)`,
      [req.params.id, req.user.role, req.user.id],
    );

    if (!ticket.rows[0]) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const messages = await req.db.query(
      `SELECT tm.id, tm.sender_id, u.email AS sender_email, tm.message, tm.created_at
         FROM ticket_messages tm
         JOIN users u ON u.id = tm.sender_id
        WHERE tm.ticket_id = $1
        ORDER BY tm.created_at ASC`,
      [req.params.id],
    );

    return res.json({
      ...ticket.rows[0],
      messages: messages.rows,
    });
  }),
);

router.post(
  '/:id/messages',
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const visible = await req.db.query(
      `SELECT t.id
         FROM tickets t
         JOIN customers c ON c.id = t.customer_id
        WHERE t.id = $1
          AND ($2::text <> 'customer' OR c.user_id = $3)`,
      [req.params.id, req.user.role, req.user.id],
    );

    if (!visible.rows[0]) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { rows } = await req.db.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, ticket_id, sender_id, message, created_at`,
      [req.params.id, req.user.id, req.body.message],
    );

    await req.db.query(
      `UPDATE tickets
          SET updated_at = now()
        WHERE id = $1`,
      [req.params.id],
    );

    return res.status(201).json(rows[0]);
  }),
);

router.patch(
  '/:id/status',
  checkRole('support_agent', 'super_admin'),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const { rows } = await req.db.query(
      `UPDATE tickets
          SET status = $2,
              agent_id = COALESCE(agent_id, $3),
              updated_at = now()
        WHERE id = $1
      RETURNING id, subject, status, agent_id, updated_at`,
      [req.params.id, req.body.status, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    await auditLog(req.db, {
      userId: req.user.id,
      action: 'ticket.status.update',
      resource: 'tickets',
      resourceId: req.params.id,
      metadata: { status: req.body.status },
    });

    return res.json(rows[0]);
  }),
);

module.exports = router;
