-- Informative classification only: keep ownership, roles, permissions and agreements.
BEGIN;
ALTER TABLE findi.stores ADD COLUMN business_type text NOT NULL DEFAULT 'ferreteria'
 CHECK(business_type IN ('ferreteria','repuestos','desarmaduria'));
UPDATE findi.stores SET api_payload=api_payload || jsonb_build_object('tipoNegocio',business_type) WHERE api_payload IS NOT NULL;
UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers';
UPDATE findi.public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',COALESCE((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta';
COMMIT;
