-- 0001 · Foundations (J0, ADR-03 and ADR-08)
-- Append-only audit events, a transactional outbox, and feature flags, with row-level security.
-- Runs as oontu_owner. The API role oontu_app gets only the grants below and never owns a table.

-- The tenant and actor context set by withTx() for the current transaction (empty means none).
CREATE FUNCTION app_tenant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
CREATE FUNCTION app_platform_user() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.platform_user_id', true), '') $$;

-- Audit (ADR-08): one row per state change. Tenant rows always carry their tenant; platform rows never do.
CREATE TABLE audit_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plane        text NOT NULL CHECK (plane IN ('tenant', 'platform')),
  tenant_id    uuid,
  actor_type   text NOT NULL CHECK (actor_type IN ('user', 'platform_user', 'system', 'agent', 'link')),
  actor_id     text,
  action       text NOT NULL CHECK (length(action) BETWEEN 1 AND 200),
  entity_type  text,
  entity_id    text,
  before       jsonb,
  after        jsonb,
  reason       text,
  at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((plane = 'tenant') = (tenant_id IS NOT NULL))
);
CREATE INDEX audit_events_tenant_at ON audit_events (tenant_id, at);

-- Outbox (ADR-08): written in the same transaction as the change it announces; a relay publishes it.
CREATE TABLE outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,
  type          text NOT NULL CHECK (type ~ '^[a-z_]+\.[a-z_]+$'),   -- entity.past_tense
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text
);
CREATE INDEX outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;

-- Feature flags: platform-wide when tenant_id is null, per tenant otherwise.
CREATE TABLE feature_flags (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   uuid,
  key         text NOT NULL,
  enabled     boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);

-- Grants: the API can add audit rows and read its own; it can never change or delete them.
GRANT SELECT, INSERT ON audit_events TO oontu_app;
GRANT SELECT, INSERT ON outbox TO oontu_app;
GRANT SELECT ON feature_flags TO oontu_app;

-- Row-level security. Table owners (migrations, the relay) are exempt; oontu_app is not.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_read ON audit_events FOR SELECT TO oontu_app
  USING (tenant_id = app_tenant() OR (tenant_id IS NULL AND app_platform_user() IS NOT NULL));
CREATE POLICY audit_tenant_write ON audit_events FOR INSERT TO oontu_app
  WITH CHECK (tenant_id IS NOT DISTINCT FROM app_tenant() AND (tenant_id IS NOT NULL OR app_platform_user() IS NOT NULL));

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_tenant_read ON outbox FOR SELECT TO oontu_app USING (tenant_id = app_tenant());
CREATE POLICY outbox_tenant_write ON outbox FOR INSERT TO oontu_app
  WITH CHECK (tenant_id IS NOT DISTINCT FROM app_tenant() AND (tenant_id IS NOT NULL OR app_platform_user() IS NOT NULL));

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY flags_read ON feature_flags FOR SELECT TO oontu_app USING (tenant_id IS NULL OR tenant_id = app_tenant());
