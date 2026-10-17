BEGIN;
SET search_path=findi,pg_catalog;
CREATE TABLE donor_vehicles (
 id text PRIMARY KEY,
 store_id text NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
 brand_id text NOT NULL,
 model_id text NOT NULL,
 year integer NOT NULL CHECK(year BETWEEN 1886 AND 2100),
 status text NOT NULL CHECK(status IN ('disponible','en_desarme','agotado')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 api_payload jsonb NOT NULL,
 UNIQUE(id,store_id),
 FOREIGN KEY(model_id,brand_id) REFERENCES vehicle_models(id,brand_id) ON DELETE RESTRICT
);
CREATE INDEX donor_vehicles_store ON donor_vehicles(store_id,updated_at DESC);
ALTER TABLE donor_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON donor_vehicles TO findi_backend USING(true) WITH CHECK(true);
REVOKE ALL ON donor_vehicles FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON donor_vehicles TO findi_backend;
ALTER TABLE offers ADD COLUMN donor_vehicle_id text;
ALTER TABLE offers ADD COLUMN donor_item_id text;
ALTER TABLE offers ADD CONSTRAINT offer_donor_owner FOREIGN KEY(donor_vehicle_id,store_id) REFERENCES donor_vehicles(id,store_id) ON DELETE RESTRICT;
ALTER TABLE offers ADD CONSTRAINT offer_donor_pair CHECK((donor_vehicle_id IS NULL)=(donor_item_id IS NULL));
ALTER TABLE offers DROP CONSTRAINT offers_store_id_product_id_key;
CREATE UNIQUE INDEX offers_regular_store_product ON offers(store_id,product_id) WHERE donor_vehicle_id IS NULL;
CREATE UNIQUE INDEX offers_donor_item ON offers(donor_vehicle_id,donor_item_id) WHERE donor_vehicle_id IS NOT NULL;
-- Even a direct database write cannot bypass the business restriction.
CREATE FUNCTION check_donor_offer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.donor_vehicle_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM stores WHERE id=NEW.store_id AND business_type IN ('desarmaduria','repuestos')) THEN
  RAISE EXCEPTION 'DONOR_STORE_TYPE_INVALID';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offer_donor_store BEFORE INSERT OR UPDATE OF donor_vehicle_id,store_id ON offers FOR EACH ROW EXECUTE FUNCTION check_donor_offer();
COMMIT;
