ALTER TABLE sellers
  DROP CONSTRAINT IF EXISTS sellers_subscription_status_check,
  ADD CONSTRAINT sellers_subscription_status_check
    CHECK (subscription_status IN ('pending', 'trialing', 'active', 'expired', 'cancelled', 'admin_override'));

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check,
  ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('pending', 'trialing', 'active', 'expired', 'cancelled', 'admin_override'));

DROP POLICY IF EXISTS sellers_scope ON sellers;

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

CREATE INDEX IF NOT EXISTS subscriptions_seller_status_expires_idx
  ON subscriptions (seller_id, status, expires_at DESC);
