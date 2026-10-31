import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

// Match the original Cloud SQL bootstrap. 004 is a disposable validation fixture,
// never a production migration. Historical file contents and hashes stay intact.
export const HISTORICAL_MIGRATIONS = Object.freeze([
  '001-schema.sql', '002-public-views.sql', '003-security.sql',
  '005-runtime-compatibility.sql', '006-sql-connect-inspection.sql',
  '007-complete-console-inspection.sql', '008-location-reference-tables.sql',
  '009-complete-location-inspection.sql', '010-maintain-location-links.sql',
  '011-quotation-verification.sql', '012-advisory-quotation-period.sql',
  '013-store-reviews.sql', '014-visit-analytics.sql', '015-offer-condition.sql',
  '016-store-business-type.sql', '017-vehicle-reference-catalog.sql',
  '018-offer-vehicle-applications.sql', '019-product-vehicle-applications.sql',
  '020-donor-vehicles.sql', '021-donor-trigger-search-path.sql',
  '022-blocked-account-status.sql', '023-hardware-only.sql',
  '024-professional-quotation-limit.sql'
]);

const migrationDirectory = new URL('../../../sql/findi/', import.meta.url);
const migrationHash = sql => createHash('sha256').update(sql).digest('hex');

function transactionBody(sql, version) {
  // These files have exactly one outer BEGIN/COMMIT. Move that boundary around
  // the ledger INSERT too, so a failed ledger write cannot leave untracked DDL.
  const start = /^(?:\s|--[^\n]*(?:\n|$))*BEGIN\s*;/i.exec(sql);
  const end = /\bCOMMIT\s*;\s*(?:--[^\n]*(?:\n|$)\s*)*$/i.exec(sql);
  if (!start || !end || end.index < start[0].length) throw new Error(`SQL_MIGRATION_TRANSACTION_REQUIRED: ${version}`);
  return sql.slice(start[0].length, end.index);
}

// Pass one checked-out, direct (unpooled) PostgreSQL client, not pool.query:
// the advisory lock and all migration transactions must share the same session.
export async function applySchemaMigrations(client, {
  migrations = HISTORICAL_MIGRATIONS,
  readMigration = version => readFile(new URL(version, migrationDirectory), 'utf8'),
  onApplied = () => {}
} = {}) {
  if (new Set(migrations).size !== migrations.length || migrations.some(version => !/^\d{3}-[a-z0-9-]+\.sql$/.test(version) || version === '004-validation.sql')) {
    throw new Error('SQL_MIGRATION_LIST_INVALID');
  }
  const files = await Promise.all(migrations.map(async version => {
    const sql = await readMigration(version);
    return { version, sha256: migrationHash(sql), body: transactionBody(sql, version) };
  }));
  await client.query('SELECT pg_advisory_lock(583728492)');
  try {
    await client.query('CREATE TABLE IF NOT EXISTS public.findi_schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    await client.query('REVOKE ALL ON public.findi_schema_migrations FROM PUBLIC');
    const appliedRows = await client.query('SELECT version,sha256 FROM public.findi_schema_migrations');
    const known = new Map(appliedRows.rows.map(row => [row.version, row.sha256]));
    // Validate every known checksum before applying any pending migration.
    for (const file of files) {
      if (known.has(file.version) && known.get(file.version) !== file.sha256) throw new Error(`SQL_MIGRATION_HASH_MISMATCH: ${file.version}`);
    }
    if (files.some(file => file.version === '001-schema.sql') && !known.has('001-schema.sql')) {
      const existing = await client.query("SELECT 1 FROM pg_namespace WHERE nspname='findi'");
      if (existing.rows.length) throw new Error('SQL_SCHEMA_WITHOUT_MIGRATION_HISTORY');
    }
    const result = { applied: [], skipped: [] };
    for (const file of files) {
      if (known.has(file.version)) { result.skipped.push(file.version); continue; }
      await client.query('BEGIN');
      try {
        await client.query(file.body);
        await client.query('INSERT INTO public.findi_schema_migrations(version,sha256) VALUES($1,$2)', [file.version, file.sha256]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      result.applied.push(file.version);
      await onApplied(file.version);
    }
    return result;
  } finally {
    await client.query('SELECT pg_advisory_unlock(583728492)');
  }
}

// Create runtime users with SQL: Neon Console/API-created roles inherit
// neon_superuser. Never silently turn an existing administrator into runtime.
export async function configureRuntimeRole(client, { role = 'findi_runtime', password, provider = 'neon', backendRole = 'findi_backend' } = {}) {
  if (!['cloudsql', 'neon'].includes(provider)) throw new Error('SQL_PROVIDER_INVALID');
  if (typeof role !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(role) || role.startsWith('pg_') || ['neon_superuser', 'cloudsqlsuperuser', 'postgres'].includes(role)) throw new Error('SQL_RUNTIME_ROLE_INVALID');
  if (typeof backendRole !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(backendRole) || backendRole === role) throw new Error('SQL_BACKEND_ROLE_INVALID');
  if (typeof password !== 'string' || password.length < 12 || password.includes('\0')) throw new Error('SQL_RUNTIME_PASSWORD_INVALID');
  const name = pg.escapeIdentifier(role);
  await client.query('BEGIN');
  try {
    const current = (await client.query(`SELECT r.rolname,r.rolsuper,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolbypassrls,
      EXISTS(SELECT 1 FROM pg_roles elevated WHERE elevated.rolname IN ('neon_superuser','cloudsqlsuperuser') AND pg_has_role(r.oid,elevated.oid,'MEMBER')) AS elevated_membership,
      EXISTS(SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND d.datdba=r.oid) AS owns_database,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('findi','findi_migration','findi_inspection') AND n.nspowner=r.oid) AS owns_schema
      FROM pg_roles r WHERE r.rolname=$1`, [role])).rows[0];
    if (current && ['rolsuper', 'rolcreaterole', 'rolcreatedb', 'rolreplication', 'rolbypassrls', 'elevated_membership', 'owns_database', 'owns_schema'].some(key => current[key])) throw new Error('SQL_RUNTIME_ROLE_PRIVILEGED');
    if (current) await client.query(`ALTER ROLE ${name} LOGIN PASSWORD ${pg.escapeLiteral(password)}`);
    else await client.query(`CREATE ROLE ${name} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`);
    const database = (await client.query('SELECT current_database() AS name')).rows[0].name;
    await client.query(`GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(database)} TO ${name}`);
    await client.query(`GRANT ${pg.escapeIdentifier(backendRole)} TO ${name}`);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM ${name}`);
    await client.query('COMMIT');
    return { role, provider, backendRole };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
