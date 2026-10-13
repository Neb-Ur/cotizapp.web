BEGIN;
SET search_path=findi,pg_catalog;
ALTER TABLE families ADD COLUMN supports_vehicle_applications boolean NOT NULL DEFAULT false;
UPDATE families SET api_payload=api_payload || jsonb_build_object('permiteVehiculos',false) WHERE api_payload IS NOT NULL;
CREATE TABLE brand_uses (
 brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
 use_kind text NOT NULL CHECK(use_kind IN ('fabricante','vehiculo')),
 PRIMARY KEY(brand_id,use_kind)
);
INSERT INTO brand_uses(brand_id,use_kind) SELECT id,'fabricante' FROM brands;
UPDATE brands SET api_payload=api_payload || jsonb_build_object('usos',jsonb_build_array('fabricante'),'nombreNormalizado',normalized_name) WHERE api_payload IS NOT NULL;
CREATE TABLE vehicle_models (
 id text PRIMARY KEY,
 brand_id text NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
 brand_use text NOT NULL DEFAULT 'vehiculo' CHECK(brand_use='vehiculo'),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 normalized_name text NOT NULL CHECK(length(normalized_name)>0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 api_payload jsonb,api_version bigint NOT NULL DEFAULT 1,
 UNIQUE(brand_id,normalized_name),UNIQUE(id,brand_id),
 FOREIGN KEY(brand_id,brand_use) REFERENCES brand_uses(brand_id,use_kind) ON DELETE RESTRICT
);
CREATE INDEX vehicle_models_brand_active ON vehicle_models(brand_id,active);
ALTER TABLE brand_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_backend ON brand_uses TO findi_backend USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON vehicle_models TO findi_backend USING(true) WITH CHECK(true);
REVOKE ALL ON brand_uses,vehicle_models FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON brand_uses,vehicle_models TO findi_backend;
UPDATE catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope IN ('static','offers');
UPDATE public_cache_artifacts SET payload=payload || jsonb_build_object('dirty',true,'generation',COALESCE((payload->>'generation')::bigint,0)+1),updated_at=now() WHERE key='meta';
INSERT INTO public_cache_artifacts(key,scope,version,payload,schema_version,updated_at)
 SELECT 'catalog-revision','static','',jsonb_build_object('revision',revision),1,now() FROM catalog_revisions WHERE scope='static'
 ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now();
COMMIT;
