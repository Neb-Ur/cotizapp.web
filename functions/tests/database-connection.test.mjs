import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import pg from 'pg';
import { Connector } from '@google-cloud/cloud-sql-connector';
import { sqlConfig, sqlProvider, sqlSchemaVariant, useSqlDatabase } from '../lib/database/config.js';
import { neonPoolOptions } from '../lib/database/neon-connection.js';

const pooledUrl = 'postgresql://runtime:p%40ss%3Aword@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

function environment(t, changes) {
  for (const [key, value] of Object.entries(changes)) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

async function poolFixture(t, provider, url = pooledUrl) {
  environment(t, { SQL_PROVIDER: provider });
  const module = await import(`../lib/database/pool.js?fixture=${crypto.randomUUID()}`);
  const pools = [];
  class FixturePool extends EventEmitter {
    constructor(options) { super(); this.options = options; pools.push(this); }
  }
  t.mock.method(pg, 'Pool', FixturePool);
  t.mock.method(module.neonDatabaseUrl, 'value', () => url);
  return { ...module, pools };
}

test('SQL provider defaults to Cloud SQL and accepts only explicit supported providers', t => {
  environment(t, { SQL_PROVIDER: undefined, USE_SQL_DATABASE: 'false' });
  assert.equal(sqlProvider(), 'cloudsql');
  assert.equal(useSqlDatabase(), false);
  process.env.SQL_PROVIDER = 'neon';
  assert.equal(sqlProvider(), 'neon');
  process.env.SQL_PROVIDER = 'cloudsql';
  assert.equal(sqlProvider(), 'cloudsql');
  for (const value of ['Neon', 'postgres', 'true', 'neon ']) {
    process.env.SQL_PROVIDER = value;
    assert.throws(sqlProvider, { message: 'SQL_PROVIDER_INVALID' });
  }
});

test('SQL schema variant defaults to legacy and accepts compact without requiring the SQL flag during discovery', t => {
  environment(t, { SQL_SCHEMA_VARIANT: undefined, USE_SQL_DATABASE: undefined });
  assert.equal(sqlSchemaVariant(), 'legacy');
  assert.equal(useSqlDatabase(), false);
  process.env.SQL_SCHEMA_VARIANT = 'compact';
  assert.equal(sqlSchemaVariant(), 'compact');
  process.env.SQL_SCHEMA_VARIANT = 'legacy';
  assert.equal(sqlSchemaVariant(), 'legacy');
});

test('SQL schema variant rejects unsupported values without exposing their contents', t => {
  environment(t, { SQL_SCHEMA_VARIANT: undefined });
  for (const value of ['relational', 'Compact', 'compact ', 'postgresql://secret:password@example.invalid/db']) {
    process.env.SQL_SCHEMA_VARIANT = value;
    assert.throws(sqlSchemaVariant, { message: 'SQL_SCHEMA_VARIANT_INVALID' });
  }
});

test('Cloud SQL configuration remains available for rollback', t => {
  environment(t, { SQL_INSTANCE_CONNECTION_NAME: undefined, SQL_DATABASE_NAME: undefined, SQL_DATABASE_USER: undefined });
  assert.deepEqual(sqlConfig(), {
    instance: 'cotizapp-d71c8:us-east4:cotizapp-d71c8-instance',
    database: 'cotizapp-d71c8-database', user: 'findi_runtime', serviceId: 'cotizapp-d71c8-service', location: 'us-east4'
  });
  process.env.SQL_INSTANCE_CONNECTION_NAME = 'rollback:region:instance';
  process.env.SQL_DATABASE_NAME = 'rollback_db';
  process.env.SQL_DATABASE_USER = 'rollback_runtime';
  assert.equal(sqlConfig().instance, 'rollback:region:instance');
  assert.equal(sqlConfig().database, 'rollback_db');
  assert.equal(sqlConfig().user, 'rollback_runtime');
});

test('Neon options preserve pooled endpoint and percent-encoded credentials with verified TLS', () => {
  const options = neonPoolOptions(pooledUrl);
  assert.equal(options.host, 'ep-example-pooler.us-east-2.aws.neon.tech');
  assert.equal(options.port, 5432);
  assert.equal(options.database, 'neondb');
  assert.equal(options.user, 'runtime');
  assert.equal(options.password, 'p@ss:word');
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(options.enableChannelBinding, true);
  assert.equal(options.connectionString, undefined);
  const client = new pg.Client(options);
  assert.equal(client.enableChannelBinding, true);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.host, options.host);
});

test('Neon accepts both PostgreSQL URI schemes and explicitly supplied connection options', () => {
  const options = neonPoolOptions('postgres://user:password@ep-example-pooler.eu-central-1.aws.neon.tech:5433/my%20database?sslmode=verify-full&options=endpoint%3Dep-example&application_name=trovio');
  assert.equal(options.port, 5433);
  assert.equal(options.database, 'my database');
  assert.equal(options.options, 'endpoint=ep-example');
  assert.equal(options.application_name, 'trovio');
});

test('URL query overrides and process SSL settings cannot weaken Neon TLS or redirect its endpoint', t => {
  environment(t, { PGSSLMODE: 'no-verify', PGHOST: 'wrong-host', PGDATABASE: 'wrong-db', PGUSER: 'wrong-user' });
  const options = neonPoolOptions(pooledUrl + '&host=wrong-host&user=wrong-user&password=wrong-password&database=wrong-db&uselibpqcompat=true');
  const client = new pg.Client(options);
  assert.equal(client.enableChannelBinding, true);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(client.connectionParameters.host, 'ep-example-pooler.us-east-2.aws.neon.tech');
  assert.equal(client.connectionParameters.database, 'neondb');
  assert.equal(client.connectionParameters.user, 'runtime');
  assert.equal(client.connectionParameters.password, 'p@ss:word');
});

test('Neon rejects invalid URLs without exposing credentials or URL parser input', () => {
  assert.throws(() => neonPoolOptions(''), { message: 'NEON_DATABASE_URL_NOT_CONFIGURED' });
  for (const url of [
    'not a URL', 'https://user:private-password@example.test/db',
    'postgres://user:private-password@/db', 'postgres://user:private-password@example.test',
    'postgres://user@example.test/db', 'postgres://:private-password@example.test/db',
    'postgres://user:private-password@example.test:99999/db',
    'postgres://user:%ZZ@example.test/db', 'postgres://user:private-password@example.test/db#fragment'
  ]) {
    assert.throws(() => neonPoolOptions(url), error => {
      assert.equal(error.message, 'NEON_DATABASE_URL_INVALID');
      assert.equal(error.input, undefined);
      assert.equal(error.cause, undefined);
      assert.ok(!error.stack.includes('private-password'));
      return true;
    });
  }
});

test('Neon rejects insecure TLS settings and certificate file overrides', () => {
  const base = 'postgresql://user:password@ep-example-pooler.eu-central-1.aws.neon.tech/db?';
  for (const query of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=prefer', 'sslmode=verify-ca', 'ssl=0', 'ssl=false', 'ssl=no-verify', 'sslrootcert=/tmp/root.crt', 'sslcert=/tmp/cert', 'sslkey=/tmp/key']) {
    assert.throws(() => neonPoolOptions(base + query), { message: 'NEON_DATABASE_TLS_REQUIRED' });
  }
});

test('Neon pool is reused and never reads Cloud SQL secrets or initializes its connector', async t => {
  const { sqlPool, databaseSecrets, sqlPassword, pools } = await poolFixture(t, 'neon');
  t.mock.method(sqlPassword, 'value', () => { throw new Error('CLOUD_SQL_SECRET_MUST_NOT_BE_READ'); });
  const connector = t.mock.method(Connector.prototype, 'getOptions', async () => { throw new Error('CLOUD_SQL_CONNECTOR_MUST_NOT_BE_USED'); });
  assert.deepEqual(databaseSecrets().map(secret => secret.name), ['DATABASE_URL']);
  const [first, second] = await Promise.all([sqlPool(), sqlPool()]);
  assert.equal(first, second);
  assert.equal(await sqlPool(), first);
  assert.equal(pools.length, 1);
  assert.equal(connector.mock.callCount(), 0);
  assert.equal(first.options.max, 4);
  assert.equal(first.options.idleTimeoutMillis, 30_000);
  assert.equal(first.options.connectionTimeoutMillis, 15_000);
  const logs = t.mock.method(console, 'error', () => {});
  first.emit('error', Object.assign(new Error(pooledUrl), { name: pooledUrl }));
  assert.deepEqual(logs.mock.calls.map(call => call.arguments), [['SQL_POOL_ERROR']]);
});

test('invalid Neon initialization retries its provider without falling back to Cloud SQL', async t => {
  const { sqlPool, neonDatabaseUrl, pools } = await poolFixture(t, 'neon', 'https://user:private-password@example.test/db');
  const connector = t.mock.method(Connector.prototype, 'getOptions', async () => { throw new Error('UNEXPECTED_GCP_FALLBACK'); });
  await assert.rejects(sqlPool(), { message: 'NEON_DATABASE_URL_INVALID' });
  assert.equal(pools.length, 0);
  t.mock.method(neonDatabaseUrl, 'value', () => pooledUrl);
  assert.equal((await sqlPool()).options.host, 'ep-example-pooler.us-east-2.aws.neon.tech');
  assert.equal(connector.mock.callCount(), 0);
});

test('Cloud SQL rollback uses its original secret and connector only', async t => {
  const { sqlPool, databaseSecrets, sqlPassword, neonDatabaseUrl, pools } = await poolFixture(t, 'cloudsql');
  environment(t, { SQL_INSTANCE_CONNECTION_NAME: 'rollback:region:instance', SQL_DATABASE_NAME: 'rollback_db', SQL_DATABASE_USER: 'rollback_runtime' });
  t.mock.method(neonDatabaseUrl, 'value', () => { throw new Error('NEON_SECRET_MUST_NOT_BE_READ'); });
  t.mock.method(sqlPassword, 'value', () => 'fixture-password');
  const connector = t.mock.method(Connector.prototype, 'getOptions', async () => ({ stream: () => {} }));
  assert.deepEqual(databaseSecrets().map(secret => secret.name), ['FINDI_SQL_PASSWORD']);
  const pool = await sqlPool();
  assert.equal(pools.length, 1);
  assert.equal(pool.options.database, 'rollback_db');
  assert.equal(pool.options.user, 'rollback_runtime');
  assert.equal(pool.options.password, 'fixture-password');
  assert.equal(typeof pool.options.stream, 'function');
  assert.deepEqual(connector.mock.calls[0].arguments, [{ instanceConnectionName: 'rollback:region:instance', ipType: 'PUBLIC' }]);
});
