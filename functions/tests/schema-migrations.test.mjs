import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { HISTORICAL_MIGRATIONS, applySchemaMigrations, configureRuntimeRole } from '../scripts/lib/schema-migrations.mjs';

async function fixture(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  const client = { query: async (sql, params) => params ? pg.query(sql, params) : (await pg.exec(sql)).at(-1) };
  return { pg, client };
}

test('generic runner replays unchanged historical migrations and skips matching hashes', async t => {
  const { pg, client } = await fixture(t);
  const bootstrap = await readFile(new URL('../scripts/bootstrap-sql.mjs', import.meta.url), 'utf8');
  const originalList = bootstrap.match(/const migrations=(\[[^;]+\]);/)[1].replaceAll("'", '"');
  assert.deepEqual(HISTORICAL_MIGRATIONS, JSON.parse(originalList));
  assert.equal(HISTORICAL_MIGRATIONS.includes('004-validation.sql'), false);
  const first = await applySchemaMigrations(client);
  assert.deepEqual(first.applied, HISTORICAL_MIGRATIONS);
  assert.deepEqual(first.skipped, []);
  const second = await applySchemaMigrations(client);
  assert.deepEqual(second.applied, []);
  assert.deepEqual(second.skipped, HISTORICAL_MIGRATIONS);
  const rows = (await pg.query('SELECT version,sha256 FROM public.findi_schema_migrations ORDER BY version')).rows;
  for (const row of rows) {
    const sql = await readFile(new URL('../../sql/findi/' + row.version, import.meta.url), 'utf8');
    assert.equal(row.sha256, createHash('sha256').update(sql).digest('hex'));
  }
  assert.equal((await pg.query("SELECT column_default FROM information_schema.columns WHERE table_schema='findi' AND table_name='users' AND column_name='quotation_limit'")).rows[0].column_default, '50');
  await configureRuntimeRole(client, { password: "local-test-'password\\only" });
  const role = (await pg.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='findi_runtime'")).rows[0];
  assert.deepEqual(role, { rolcanlogin: true, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false });
  assert.equal((await pg.query("SELECT pg_has_role('findi_runtime','findi_backend','MEMBER') AS member")).rows[0].member, true);
  await pg.exec('SET ROLE findi_runtime');
  await pg.query("INSERT INTO findi.categories(id,name) VALUES('local-reference','Local')");
  await assert.rejects(pg.exec('CREATE TABLE findi.not_allowed(id int)'), /permission denied/);
  await pg.exec('RESET ROLE');
  await configureRuntimeRole(client, { password: 'rotated-local-only-password' });
});

test('hash mismatches reject all pending DDL and failed migrations roll back DDL plus ledger', async t => {
  const { pg, client } = await fixture(t);
  const files = new Map([
    ['101-first.sql', '-- fixture\nBEGIN; CREATE TABLE public.first_test(id int); COMMIT;'],
    ['102-pending.sql', 'BEGIN; CREATE TABLE public.pending_test(id int); COMMIT;'],
    ['103-failed.sql', 'BEGIN; CREATE TABLE public.failed_test(id int); INSERT INTO public.missing_table VALUES(1); COMMIT;'],
    ['104-ledger.sql', 'BEGIN; CREATE TABLE public.ledger_test(id int); COMMIT;']
  ]);
  const readMigration = name => files.get(name);
  await applySchemaMigrations(client, { migrations: ['101-first.sql'], readMigration });
  files.set('101-first.sql', files.get('101-first.sql') + '\n-- changed');
  await assert.rejects(applySchemaMigrations(client, { migrations: ['102-pending.sql', '101-first.sql'], readMigration }), /HASH_MISMATCH/);
  assert.equal((await pg.query("SELECT to_regclass('public.pending_test') AS relation")).rows[0].relation, null);
  await assert.rejects(applySchemaMigrations(client, { migrations: ['103-failed.sql'], readMigration }), /missing_table/);
  assert.equal((await pg.query("SELECT to_regclass('public.failed_test') AS relation")).rows[0].relation, null);
  const failLedger = { query(sql, params) { if (sql.startsWith('INSERT INTO public.findi_schema_migrations')) throw new Error('ledger unavailable'); return client.query(sql, params); } };
  await assert.rejects(applySchemaMigrations(failLedger, { migrations: ['104-ledger.sql'], readMigration }), /ledger unavailable/);
  assert.equal((await pg.query("SELECT to_regclass('public.ledger_test') AS relation")).rows[0].relation, null);
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM public.findi_schema_migrations')).rows[0].count, 1);
  assert.deepEqual((await applySchemaMigrations(client, { migrations: ['102-pending.sql'], readMigration })).applied, ['102-pending.sql']);
});

test('runner rejects untracked existing schemas and test-only or unsafe migration lists', async t => {
  const { pg, client } = await fixture(t);
  await pg.exec('CREATE SCHEMA findi');
  await assert.rejects(applySchemaMigrations(client, { migrations: ['001-schema.sql'] }), /SCHEMA_WITHOUT_MIGRATION_HISTORY/);
  for (const migrations of [['004-validation.sql'], ['../001-schema.sql'], ['001-schema.sql', '001-schema.sql']]) {
    await assert.rejects(applySchemaMigrations(client, { migrations }), /LIST_INVALID/);
  }
  await assert.rejects(applySchemaMigrations(client, { migrations: ['101-unwrapped.sql'], readMigration: () => 'CREATE TABLE public.untracked(id int);' }), /TRANSACTION_REQUIRED/);
});

test('Neon runtime configuration rejects privileged roles and rolls back incomplete role grants', async t => {
  const { pg, client } = await fixture(t);
  await pg.exec('CREATE ROLE neon_superuser NOLOGIN; CREATE ROLE elevated LOGIN; GRANT neon_superuser TO elevated;');
  await assert.rejects(configureRuntimeRole(client, { role: 'elevated', password: 'local-only-password' }), /PRIVILEGED/);
  await assert.rejects(configureRuntimeRole(client, { role: 'rollback_runtime', password: 'local-only-password' }), /findi_backend/);
  assert.equal((await pg.query("SELECT count(*)::int AS count FROM pg_roles WHERE rolname='rollback_runtime'")).rows[0].count, 0);
  await assert.rejects(configureRuntimeRole(client, { role: 'neon_superuser', password: 'local-only-password' }), /ROLE_INVALID/);
});
