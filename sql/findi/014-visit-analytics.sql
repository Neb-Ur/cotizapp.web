BEGIN;
CREATE TABLE IF NOT EXISTS findi.visit_daily_keys (
 visit_date date NOT NULL,
 visitor_key text NOT NULL CHECK (visitor_key ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY (visit_date, visitor_key)
);
CREATE INDEX IF NOT EXISTS visit_keys_expiry ON findi.visit_daily_keys(expires_at);
CREATE TABLE IF NOT EXISTS findi.visit_daily_totals (
 visit_date date PRIMARY KEY,
 unique_visits bigint NOT NULL DEFAULT 0 CHECK (unique_visits >= 0)
);
ALTER TABLE findi.visit_daily_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE findi.visit_daily_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON findi.visit_daily_keys TO findi_backend USING (true) WITH CHECK (true);
CREATE POLICY trusted_backend ON findi.visit_daily_totals TO findi_backend USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON findi.visit_daily_keys, findi.visit_daily_totals TO findi_backend;
COMMIT;
