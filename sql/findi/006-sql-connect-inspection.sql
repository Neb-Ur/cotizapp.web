-- SQL Connect reads only allowlisted views. Its browser operations stay NO_ACCESS.
BEGIN;
CREATE VIEW findi.sql_connect_migration_status WITH(security_barrier=true) AS
 SELECT id,status,verified_at,updated_at FROM findi.database_migration_state;
REVOKE ALL ON findi.sql_connect_migration_status FROM PUBLIC;
GRANT SELECT ON findi.sql_connect_migration_status TO findi_backend;
DO $$
DECLARE reader record;
BEGIN
 FOR reader IN SELECT rolname FROM pg_roles WHERE rolname IN (
  'firebasereader_cotizapp-d71c8-database_public',
  'firebasewriter_cotizapp-d71c8-database_public') LOOP
  EXECUTE format('GRANT USAGE ON SCHEMA findi TO %I',reader.rolname);
  EXECUTE format('GRANT SELECT ON findi.public_products,findi.sql_connect_migration_status TO %I',reader.rolname);
 END LOOP;
END $$;
COMMIT;
