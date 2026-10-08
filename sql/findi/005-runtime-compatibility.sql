-- Backend-only compatibility metadata, not public/browser data.
-- Apply after 001..003. Typed columns and FKs remain mandatory.
BEGIN;
DO $$
DECLARE relation text;
BEGIN
 FOREACH relation IN ARRAY ARRAY['users','stores','categories','subcategories','families','brands','attribute_definitions','products','product_attributes','offers','offer_history','store_agreements','quotations','product_requests','contact_messages','consent_events','marketing_suppressions','price_reports','privacy_requests','deletion_receipts','admin_audit_logs','security_incidents','governance_evidence','ip_reports','store_event_counters','store_daily_analytics','job_runs']
 LOOP
  EXECUTE format('ALTER TABLE findi.%I ADD COLUMN api_payload jsonb, ADD COLUMN api_version bigint NOT NULL DEFAULT 1',relation);
 END LOOP;
END $$;
ALTER TABLE findi.products ADD COLUMN model_label text, ADD COLUMN manufacturer_code text, ADD COLUMN catalog_evidence jsonb;
CREATE TABLE findi.database_migration_state (
 id text PRIMARY KEY CHECK(id='firestore-to-sql'), status text NOT NULL CHECK(status IN ('copying','verified','active','failed')),
 source_project text NOT NULL, verified_at timestamptz, manifest jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE findi.source_replication_versions (
 collection_name text NOT NULL, document_id text NOT NULL, source_version numeric NOT NULL,
 deleted boolean NOT NULL DEFAULT false, replicated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection_name,document_id)
);
REVOKE ALL ON findi.database_migration_state,findi.source_replication_versions FROM PUBLIC;
-- Native SQL Connect connector views expose only schema metadata; no public data connector.
-- Runtime role has explicit server-only policies; the existing API enforces Auth,
-- account status, legal acceptance, roles and ownership before business operations.
CREATE ROLE findi_backend NOLOGIN;
GRANT USAGE ON SCHEMA findi TO findi_backend;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA findi TO findi_backend;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA findi TO findi_backend;
DO $$
DECLARE relation record;
BEGIN
 FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname='findi' LOOP
  EXECUTE format('ALTER TABLE findi.%I ENABLE ROW LEVEL SECURITY',relation.tablename);
  EXECUTE format('CREATE POLICY trusted_backend ON findi.%I TO findi_backend USING (true) WITH CHECK (true)',relation.tablename);
 END LOOP;
END $$;
-- Deferrable identity constraints remain validated at transaction commit.
-- Runtime roles cannot create tables, disable RLS, or bypass constraints.
COMMIT;
