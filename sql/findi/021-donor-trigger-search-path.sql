BEGIN;
CREATE OR REPLACE FUNCTION findi.check_donor_offer() RETURNS trigger
LANGUAGE plpgsql SET search_path=findi,pg_catalog,pg_temp AS $$
BEGIN
 IF NEW.donor_vehicle_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM findi.stores WHERE id=NEW.store_id AND business_type IN ('desarmaduria','repuestos')) THEN
  RAISE EXCEPTION 'DONOR_STORE_TYPE_INVALID';
 END IF;
 RETURN NEW;
END $$;
COMMIT;
