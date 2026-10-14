BEGIN;
SET search_path=findi,pg_catalog;
ALTER TABLE products ADD COLUMN part_name text;
ALTER TABLE products ADD COLUMN variant_label text;
ALTER TABLE products ADD COLUMN automotive_identity text;
CREATE UNIQUE INDEX products_automotive_identity_active ON products(automotive_identity) WHERE automotive_identity IS NOT NULL AND deleted_at IS NULL AND status <> 'inactivo';
CREATE TABLE product_vehicle_applications (
 product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 19),
 brand_id text NOT NULL,
 model_id text NOT NULL,
 year_from integer NOT NULL CHECK(year_from BETWEEN 1886 AND 2100),
 year_to integer NOT NULL CHECK(year_to BETWEEN year_from AND 2100),
 brand_name_snapshot text NOT NULL,
 model_name_snapshot text NOT NULL,
 PRIMARY KEY(product_id,position),
 FOREIGN KEY(model_id,brand_id) REFERENCES vehicle_models(id,brand_id) ON DELETE RESTRICT,
 UNIQUE(product_id,model_id,year_from,year_to)
);
CREATE INDEX product_vehicle_applications_model_year ON product_vehicle_applications(model_id,year_from,year_to);
ALTER TABLE product_vehicle_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON product_vehicle_applications TO findi_backend USING(true) WITH CHECK(true);
REVOKE ALL ON product_vehicle_applications FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON product_vehicle_applications TO findi_backend;
COMMIT;
