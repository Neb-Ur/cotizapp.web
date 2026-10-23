BEGIN;
ALTER TABLE findi.users DROP CONSTRAINT users_account_status_check;
ALTER TABLE findi.users ADD CONSTRAINT users_account_status_check
 CHECK(account_status IN ('activo','pendiente','inactivo','suspendido','bloqueado'));
COMMIT;