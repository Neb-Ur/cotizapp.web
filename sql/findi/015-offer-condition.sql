-- Physical condition belongs to the store offer; old offers remain unspecified.
BEGIN;
SET search_path=findi,pg_catalog;
ALTER TABLE offers ADD COLUMN condition text NOT NULL DEFAULT 'sin_especificar'
 CHECK(condition IN ('sin_especificar','nuevo','usado','reacondicionado','para_reparar'));
UPDATE offers SET api_payload=api_payload || jsonb_build_object('condicion',condition) WHERE api_payload IS NOT NULL;
CREATE OR REPLACE VIEW public_offers WITH(security_barrier=true) AS
 SELECT o.id AS offer_id,o.store_id,o.product_id,p.name AS product_name,s.business_name AS store_name,
 o.price,o.currency,o.stock,o.store_sku,o.barcode,o.includes_vat,
 o.measurement_unit,o.measurement_quantity,o.measurement_source,o.valid_from,o.valid_until,o.conditions,o.sponsored,
 (o.stock>0 AND o.price>0) AS comparison_eligible,false AS includes_shipping,
 s.latitude,s.longitude,u.address,u.commune,s.tax_id,
 COALESCE(NULLIF(s.public_email,''),u.email) AS public_email,
 COALESCE(NULLIF(s.public_phone,''),u.phone) AS public_phone,
 o.updated_at AS price_updated_at,o.condition
 FROM offers o JOIN products p ON p.id=o.product_id JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=s.owner_id
 WHERE o.active AND o.published AND o.price>0 AND p.status='activo' AND p.deleted_at IS NULL AND s.status='activo' AND u.account_status='activo'
 AND (o.valid_from IS NULL OR o.valid_from<=now()) AND (o.valid_until IS NULL OR o.valid_until>=now())
 AND s.agreement_status='vigente'
 AND EXISTS(SELECT 1 FROM legal_documents d WHERE d.kind='store_agreement' AND d.is_current
   AND d.version=s.agreement_version AND d.document_hash=s.agreement_document_hash);
UPDATE catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers';
UPDATE public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',COALESCE((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta';
COMMIT;
