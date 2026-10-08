-- Reference geography; preserves the existing free-text API fields.
BEGIN;
CREATE TABLE findi.countries (
 code text PRIMARY KEY CHECK(code ~ '^[A-Z]{2}$'), name text NOT NULL
);
CREATE TABLE findi.regions (
 code text PRIMARY KEY CHECK(code ~ '^[0-9]{2}$'), country_code text NOT NULL REFERENCES findi.countries(code),
 name text NOT NULL, abbreviation text NOT NULL, source_reference text NOT NULL
);
CREATE TABLE findi.provinces (
 code text PRIMARY KEY CHECK(code ~ '^[0-9]{3}$'), region_code text NOT NULL REFERENCES findi.regions(code),
 name text NOT NULL, UNIQUE(code,region_code)
);
CREATE TABLE findi.communes (
 code text PRIMARY KEY CHECK(code ~ '^[0-9]{5}$'), province_code text NOT NULL REFERENCES findi.provinces(code),
 name text NOT NULL, normalized_name text NOT NULL
);
CREATE INDEX communes_name ON findi.communes(normalized_name);
CREATE INDEX provinces_region ON findi.provinces(region_code);
CREATE INDEX communes_province ON findi.communes(province_code);
-- Existing application options include cities and commercial/urban groups, not
-- an authoritative urban-boundary dataset. Record their provenance explicitly.
CREATE TABLE findi.cities (
 id text PRIMARY KEY, country_code text NOT NULL REFERENCES findi.countries(code),
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('city','application_group')),
 source_reference text NOT NULL, UNIQUE(country_code,name)
);
CREATE TABLE findi.city_communes (
 city_id text NOT NULL REFERENCES findi.cities(id), commune_code text NOT NULL REFERENCES findi.communes(code),
 source_reference text NOT NULL, PRIMARY KEY(city_id,commune_code)
);
-- Relational links are derived from existing labels, never overwrite user data.
-- A separate table avoids stale new ID fields in Firestore-compatible DTOs.
CREATE TABLE findi.account_locations (
 user_id text PRIMARY KEY REFERENCES findi.users(id) ON DELETE CASCADE,
 region_code text REFERENCES findi.regions(code), commune_code text REFERENCES findi.communes(code),
 city_id text REFERENCES findi.cities(id), matched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE findi.store_locations (
 store_id text PRIMARY KEY REFERENCES findi.stores(id) ON DELETE CASCADE,
 region_code text REFERENCES findi.regions(code), commune_code text REFERENCES findi.communes(code),
 city_id text REFERENCES findi.cities(id), matched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON findi.countries,findi.regions,findi.provinces,findi.communes,findi.cities,findi.city_communes,findi.account_locations,findi.store_locations TO findi_backend;
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['countries','regions','provinces','communes','cities','city_communes','account_locations','store_locations'] LOOP
  EXECUTE format('ALTER TABLE findi.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY trusted_backend ON findi.%I TO findi_backend USING(true) WITH CHECK(true)',name);
 END LOOP;
END $$;
COMMIT;
