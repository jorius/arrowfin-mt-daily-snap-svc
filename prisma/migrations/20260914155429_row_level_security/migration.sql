-- Row-level security keyed on the tenant (design doc §3.3).
--
-- Tenant-scoped repository calls run inside a transaction that switches to the
-- non-superuser role `arrowfin_tenant` and sets `app.broker_id`
-- (see PrismaService.forTenant). Under that role a query that forgets
-- `WHERE broker_id = ?` returns nothing instead of everything.
-- Migrations, the seed, the pre-authentication lookups (credentials, API-key hash)
-- and the development-only fill simulator run as the connection owner and are
-- not subject to these policies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arrowfin_tenant') THEN
    CREATE ROLE arrowfin_tenant NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO arrowfin_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO arrowfin_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arrowfin_tenant;

ALTER TABLE "traders"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fills"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "traders"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));
CREATE POLICY tenant_isolation ON "accounts"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));
CREATE POLICY tenant_isolation ON "fills"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));
CREATE POLICY tenant_isolation ON "api_keys"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));
