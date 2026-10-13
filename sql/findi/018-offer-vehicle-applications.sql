BEGIN;
SET search_path=findi,pg_catalog;
CREATE TABLE offer_vehicle_applications (
 offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 19),
 brand_id text NOT NULL,
 model_id text NOT NULL,
 year_from integer,
 year_to integer,
 brand_name_snapshot text,
 model_name_snapshot text,
 PRIMARY KEY(offer_id,position),
 FOREIGN KEY(model_id,brand_id) REFERENCES vehicle_models(id,brand_id) ON DELETE RESTRICT,
 CHECK((year_from IS NULL AND year_to IS NULL) OR
       (year_from IS NOT NULL AND year_to IS NOT NULL AND year_from BETWEEN 1886 AND 2100 AND year_to BETWEEN year_from AND 2100)),
 UNIQUE NULLS NOT DISTINCT(offer_id,model_id,year_from,year_to)
);
CREATE INDEX offer_vehicle_applications_model_year ON offer_vehicle_applications(model_id,year_from,year_to);
ALTER TABLE offer_vehicle_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON offer_vehicle_applications TO findi_backend USING(true) WITH CHECK(true);
REVOKE ALL ON offer_vehicle_applications FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON offer_vehicle_applications TO findi_backend;
COMMIT;
