-- Keep reference links synchronized when the existing API changes location labels.
BEGIN;
CREATE FUNCTION findi.location_label(value text) RETURNS text
 LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT trim(regexp_replace(translate(lower(coalesce(value,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+',' ','g'))
$$;
CREATE FUNCTION findi.sync_location_links() RETURNS trigger
 LANGUAGE plpgsql SET search_path=findi,pg_catalog AS $$
DECLARE city_key text; commune_key text; region_key text; candidates text[];
BEGIN
 SELECT id INTO city_key FROM cities WHERE location_label(name)=location_label(NEW.city);
 SELECT array_agg(code) INTO candidates FROM communes
 WHERE normalized_name=location_label(NEW.commune)
    OR (location_label(NEW.commune)='paihuano' AND code='04105');
 IF cardinality(candidates)=1 THEN commune_key=candidates[1];
 ELSIF cardinality(candidates)>1 AND city_key IS NOT NULL THEN
  SELECT array_agg(commune_code) INTO candidates FROM city_communes WHERE city_id=city_key AND commune_code=ANY(candidates);
  IF cardinality(candidates)=1 THEN commune_key=candidates[1]; END IF;
 END IF;
 IF commune_key IS NOT NULL THEN
  SELECT p.region_code INTO region_key FROM communes c JOIN provinces p ON p.code=c.province_code WHERE c.code=commune_key;
 ELSE
  SELECT code INTO region_key FROM regions WHERE location_label(name)=location_label(NEW.region) OR code=NEW.region OR lower(abbreviation)=lower(NEW.region);
 END IF;
 IF TG_TABLE_NAME='users' THEN
  IF city_key IS NOT NULL OR commune_key IS NOT NULL OR region_key IS NOT NULL THEN
   INSERT INTO account_locations(user_id,region_code,commune_code,city_id) VALUES(NEW.id,region_key,commune_key,city_key)
   ON CONFLICT(user_id) DO UPDATE SET region_code=EXCLUDED.region_code,commune_code=EXCLUDED.commune_code,city_id=EXCLUDED.city_id,matched_at=now();
  ELSE DELETE FROM account_locations WHERE user_id=NEW.id; END IF;
 ELSE
  IF city_key IS NOT NULL OR commune_key IS NOT NULL OR region_key IS NOT NULL THEN
   INSERT INTO store_locations(store_id,region_code,commune_code,city_id) VALUES(NEW.id,region_key,commune_key,city_key)
   ON CONFLICT(store_id) DO UPDATE SET region_code=EXCLUDED.region_code,commune_code=EXCLUDED.commune_code,city_id=EXCLUDED.city_id,matched_at=now();
  ELSE DELETE FROM store_locations WHERE store_id=NEW.id; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_user_location AFTER INSERT OR UPDATE OF region,city,commune ON findi.users FOR EACH ROW EXECUTE FUNCTION findi.sync_location_links();
CREATE TRIGGER sync_store_location AFTER INSERT OR UPDATE OF region,city,commune ON findi.stores FOR EACH ROW EXECUTE FUNCTION findi.sync_location_links();
REVOKE ALL ON FUNCTION findi.location_label(text),findi.sync_location_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION findi.location_label(text),findi.sync_location_links() TO findi_backend;
COMMIT;
