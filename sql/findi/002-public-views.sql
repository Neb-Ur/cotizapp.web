-- Explicit public projections. Execute after 001 in an empty validation DB.
BEGIN;
SET search_path=findi,pg_catalog;
CREATE VIEW public_products WITH(security_barrier=true) AS
 SELECT p.id,p.name,p.product_type,p.catalog_level,p.sale_unit,p.presentation,p.barcode,
 p.short_description,p.long_description,p.brand_id,COALESCE(b.name,p.legacy_brand_label,'Por especificar') AS brand,
 p.family_id,f.name AS family_name,s.id AS subcategory_id,s.name AS subcategory_name,c.id AS category_id,c.name AS category_name,
 p.logistics_weight_kg,p.logistics_volume_m3,p.units_per_pallet,
 m.url AS image_url,m.origin AS image_origin,m.ai_disclosure,r.path AS seo_path,p.updated_at
 FROM products p JOIN families f ON f.id=p.family_id
 JOIN subcategories s ON s.id=f.subcategory_id JOIN categories c ON c.id=s.category_id
 LEFT JOIN brands b ON b.id=p.brand_id
 LEFT JOIN product_media pm ON pm.product_id=p.id AND pm.is_primary
 LEFT JOIN media_assets m ON m.id=pm.asset_id
 LEFT JOIN seo_routes r ON r.product_id=p.id AND r.is_canonical AND r.active
 WHERE p.status='activo' AND p.deleted_at IS NULL;
CREATE VIEW public_offers WITH(security_barrier=true) AS
 SELECT o.id AS offer_id,o.store_id,o.product_id,p.name AS product_name,s.business_name AS store_name,
 o.price,o.currency,o.stock,o.store_sku,o.barcode,o.includes_vat,
 o.measurement_unit,o.measurement_quantity,o.measurement_source,o.valid_from,o.valid_until,o.conditions,o.sponsored,
 (o.stock>0 AND o.price>0) AS comparison_eligible,false AS includes_shipping,
 s.latitude,s.longitude,u.address,u.commune,s.tax_id,
 COALESCE(NULLIF(s.public_email,''),u.email) AS public_email,
 COALESCE(NULLIF(s.public_phone,''),u.phone) AS public_phone,
 o.updated_at AS price_updated_at
 FROM offers o JOIN products p ON p.id=o.product_id JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=s.owner_id
 WHERE o.active AND o.published AND o.price>0 AND p.status='activo' AND p.deleted_at IS NULL AND s.status='activo' AND u.account_status='activo'
 AND (o.valid_from IS NULL OR o.valid_from<=now()) AND (o.valid_until IS NULL OR o.valid_until>=now())
 AND s.agreement_status='vigente'
 AND EXISTS(SELECT 1 FROM legal_documents d WHERE d.kind='store_agreement' AND d.is_current
   AND d.version=s.agreement_version AND d.document_hash=s.agreement_document_hash);
-- Do not add stock>0 to the WHERE: the detail lists unavailable offers too.
CREATE VIEW latest_store_analytics WITH(security_invoker=true) AS
 SELECT DISTINCT ON(store_id) * FROM store_daily_analytics ORDER BY store_id,computed_at DESC,local_date DESC;
REVOKE ALL ON public_products,public_offers,latest_store_analytics FROM PUBLIC;
COMMIT;
