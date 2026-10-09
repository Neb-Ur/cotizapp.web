-- A new verification code can be issued after the original advisory period.
-- The period must never prevent saving or verifying a quotation.
BEGIN;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='findi.quotation_verifications'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%recommended_until%issued_at%'
 LOOP EXECUTE format('ALTER TABLE findi.quotation_verifications DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
COMMIT;
