-- Expand the default product quota without changing deliberate custom limits.
-- The existing owner-row lock and trigger continue enforcing the limit atomically.
BEGIN;
ALTER TABLE findi.users ALTER COLUMN quotation_limit SET DEFAULT 50;
UPDATE findi.users SET quotation_limit = 50 WHERE quotation_limit = 2;
COMMIT;
