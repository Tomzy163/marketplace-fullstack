CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_seller_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_seller_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_role', true), ''), 'anonymous');
$$;

CREATE OR REPLACE FUNCTION app.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('super_admin', 'seller', 'customer', 'support_agent')),
  oauth_provider text,
  oauth_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_oauth_identity_idx
  ON users (oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;

CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  max_products integer CHECK (max_products IS NULL OR max_products >= 0),
  max_orders_per_month integer CHECK (max_orders_per_month IS NULL OR max_orders_per_month >= 0),
  features text[] NOT NULL DEFAULT '{}',
  paystack_plan_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  subscription_status text NOT NULL DEFAULT 'pending'
    CHECK (subscription_status IN ('pending', 'trialing', 'active', 'expired', 'cancelled', 'admin_override')),
  plan_id uuid REFERENCES plans(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  paystack_subscription_code text,
  paystack_email_token text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'trialing', 'active', 'expired', 'cancelled', 'admin_override')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  images text[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT '',
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, user_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'payment_pending'
    CHECK (status IN ('payment_pending', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded')),
  payment_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, seller_id)
);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sellers_user_id_idx ON sellers(user_id);
CREATE INDEX sellers_slug_idx ON sellers(slug);
CREATE INDEX subscriptions_seller_id_idx ON subscriptions(seller_id);
CREATE INDEX subscriptions_seller_status_expires_idx ON subscriptions(seller_id, status, expires_at DESC);
CREATE INDEX products_seller_id_idx ON products(seller_id);
CREATE INDEX customers_seller_id_idx ON customers(seller_id);
CREATE INDEX customers_user_id_idx ON customers(user_id);
CREATE INDEX orders_seller_id_idx ON orders(seller_id);
CREATE INDEX orders_customer_id_idx ON orders(customer_id);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX tickets_seller_id_idx ON tickets(seller_id);
CREATE INDEX tickets_customer_id_idx ON tickets(customer_id);
CREATE INDEX tickets_agent_id_idx ON tickets(agent_id);
CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages(ticket_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER plans_touch_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER sellers_touch_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER products_touch_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER customers_touch_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TRIGGER tickets_touch_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_public_read ON plans
  FOR SELECT
  USING (is_active = true OR app.is_super_admin());

CREATE POLICY plans_admin_write ON plans
  FOR ALL
  USING (app.is_super_admin())
  WITH CHECK (app.is_super_admin());

CREATE POLICY users_select_scope ON users
  FOR SELECT
  USING (
    app.is_super_admin()
    OR id = app.current_user_id()
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.user_id = users.id
        AND c.seller_id = app.current_seller_id()
    )
    OR EXISTS (
      SELECT 1
      FROM tickets t
      JOIN customers c ON c.id = t.customer_id
      WHERE (c.user_id = users.id OR t.agent_id = users.id)
        AND (
          t.seller_id = app.current_seller_id()
          OR EXISTS (
            SELECT 1 FROM agent_assignments aa
            WHERE aa.seller_id = t.seller_id
              AND aa.agent_id = app.current_user_id()
          )
        )
    )
  );

CREATE POLICY users_insert_from_app ON users
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY users_update_self_or_admin ON users
  FOR UPDATE
  USING (app.is_super_admin() OR id = app.current_user_id())
  WITH CHECK (app.is_super_admin() OR id = app.current_user_id());

CREATE POLICY sellers_scope ON sellers
  FOR SELECT
  USING (
    app.is_super_admin()
    OR id = app.current_seller_id()
    OR user_id = app.current_user_id()
    OR (
      app.current_role() = 'storefront'
      AND id = app.current_seller_id()
      AND subscription_status IN ('active', 'trialing', 'admin_override')
    )
    OR EXISTS (
      SELECT 1 FROM agent_assignments aa
      WHERE aa.seller_id = sellers.id
        AND aa.agent_id = app.current_user_id()
    )
  );

CREATE POLICY sellers_owner_insert ON sellers
  FOR INSERT
  WITH CHECK (app.is_super_admin() OR user_id = app.current_user_id() OR app.current_user_id() IS NULL);

CREATE POLICY sellers_owner_update ON sellers
  FOR UPDATE
  USING (app.is_super_admin() OR id = app.current_seller_id())
  WITH CHECK (app.is_super_admin() OR id = app.current_seller_id());

CREATE POLICY products_scope ON products
  FOR SELECT
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
  );

CREATE POLICY products_seller_write ON products
  FOR ALL
  USING (app.is_super_admin() OR seller_id = app.current_seller_id())
  WITH CHECK (app.is_super_admin() OR seller_id = app.current_seller_id());

CREATE POLICY customers_scope ON customers
  FOR SELECT
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR user_id = app.current_user_id()
  );

CREATE POLICY customers_write_scope ON customers
  FOR ALL
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR user_id = app.current_user_id()
  )
  WITH CHECK (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR user_id = app.current_user_id()
  );

CREATE POLICY orders_scope ON orders
  FOR SELECT
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = orders.customer_id
        AND c.user_id = app.current_user_id()
    )
  );

CREATE POLICY orders_write_scope ON orders
  FOR ALL
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = orders.customer_id
        AND c.user_id = app.current_user_id()
    )
  )
  WITH CHECK (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = orders.customer_id
        AND c.user_id = app.current_user_id()
    )
  );

CREATE POLICY order_items_scope ON order_items
  FOR SELECT
  USING (
    app.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (
          o.seller_id = app.current_seller_id()
          OR EXISTS (
            SELECT 1 FROM customers c
            WHERE c.id = o.customer_id
              AND c.user_id = app.current_user_id()
          )
        )
    )
  );

CREATE POLICY order_items_write_scope ON order_items
  FOR ALL
  USING (
    app.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.seller_id = app.current_seller_id()
    )
  )
  WITH CHECK (
    app.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.seller_id = app.current_seller_id()
    )
  );

CREATE POLICY subscriptions_scope ON subscriptions
  FOR SELECT
  USING (app.is_super_admin() OR seller_id = app.current_seller_id());

CREATE POLICY subscriptions_write_scope ON subscriptions
  FOR ALL
  USING (app.is_super_admin() OR seller_id = app.current_seller_id())
  WITH CHECK (app.is_super_admin() OR seller_id = app.current_seller_id());

CREATE POLICY agent_assignments_scope ON agent_assignments
  FOR SELECT
  USING (app.is_super_admin() OR agent_id = app.current_user_id());

CREATE POLICY agent_assignments_admin_write ON agent_assignments
  FOR ALL
  USING (app.is_super_admin())
  WITH CHECK (app.is_super_admin());

CREATE POLICY tickets_scope ON tickets
  FOR SELECT
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = tickets.customer_id
        AND c.user_id = app.current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM agent_assignments aa
      WHERE aa.seller_id = tickets.seller_id
        AND aa.agent_id = app.current_user_id()
    )
  );

CREATE POLICY tickets_write_scope ON tickets
  FOR ALL
  USING (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM agent_assignments aa
      WHERE aa.seller_id = tickets.seller_id
        AND aa.agent_id = app.current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = tickets.customer_id
        AND c.user_id = app.current_user_id()
    )
  )
  WITH CHECK (
    app.is_super_admin()
    OR seller_id = app.current_seller_id()
    OR EXISTS (
      SELECT 1 FROM agent_assignments aa
      WHERE aa.seller_id = tickets.seller_id
        AND aa.agent_id = app.current_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = tickets.customer_id
        AND c.user_id = app.current_user_id()
    )
  );

CREATE POLICY ticket_messages_scope ON ticket_messages
  FOR SELECT
  USING (
    app.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM tickets t
      JOIN customers c ON c.id = t.customer_id
      WHERE t.id = ticket_messages.ticket_id
        AND (
          t.seller_id = app.current_seller_id()
          OR c.user_id = app.current_user_id()
          OR EXISTS (
            SELECT 1 FROM agent_assignments aa
            WHERE aa.seller_id = t.seller_id
              AND aa.agent_id = app.current_user_id()
          )
        )
    )
  );

CREATE POLICY ticket_messages_write_scope ON ticket_messages
  FOR ALL
  USING (
    app.is_super_admin()
    OR sender_id = app.current_user_id()
  )
  WITH CHECK (
    app.is_super_admin()
    OR sender_id = app.current_user_id()
  );

CREATE POLICY refresh_tokens_owner ON refresh_tokens
  FOR ALL
  USING (app.is_super_admin() OR user_id = app.current_user_id() OR app.current_user_id() IS NULL)
  WITH CHECK (app.is_super_admin() OR user_id = app.current_user_id() OR app.current_user_id() IS NULL);

CREATE POLICY audit_logs_scope ON audit_logs
  FOR SELECT
  USING (app.is_super_admin() OR user_id = app.current_user_id());

CREATE POLICY audit_logs_insert_from_app ON audit_logs
  FOR INSERT
  WITH CHECK (true);

INSERT INTO plans (name, price, max_products, max_orders_per_month, features)
VALUES
  ('Starter', 5000, 50, 300, ARRAY['Storefront', 'Product catalog', 'Email support']),
  ('Growth', 15000, 500, 3000, ARRAY['Analytics', 'Inventory alerts', 'Priority support']),
  ('Scale', 45000, NULL, NULL, ARRAY['Unlimited products', 'Advanced analytics', 'Dedicated support'])
ON CONFLICT (name) DO NOTHING;
