-- Immutable, server-issued verification snapshots. No customer contact data.
BEGIN;
CREATE TABLE findi.quotation_verifications (
 id text PRIMARY KEY, code text NOT NULL UNIQUE,
 quotation_reference text NOT NULL,
 issued_at timestamptz NOT NULL,
 recommended_until timestamptz NOT NULL,
 store_lines jsonb NOT NULL CHECK(jsonb_typeof(store_lines)='array'),
 api_payload jsonb NOT NULL, api_version bigint NOT NULL DEFAULT 1,
 CHECK(code=id), CHECK(recommended_until>=issued_at)
);
ALTER TABLE findi.quotation_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON findi.quotation_verifications TO findi_backend USING(true) WITH CHECK(true);
GRANT SELECT, INSERT, UPDATE ON findi.quotation_verifications TO findi_backend;
REVOKE ALL ON findi.quotation_verifications FROM PUBLIC;
CREATE FUNCTION findi.prevent_verification_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'QUOTATION_VERIFICATION_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_verification BEFORE UPDATE OR DELETE ON findi.quotation_verifications FOR EACH ROW EXECUTE FUNCTION findi.prevent_verification_change();
COMMIT;
