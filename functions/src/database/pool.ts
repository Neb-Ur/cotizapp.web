import pg from 'pg';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { sqlConfig, sqlProvider } from './config.js';
import { neonPoolOptions } from './neon-connection.js';
import { defineSecret, type SecretParam } from 'firebase-functions/params';

export const sqlPassword = defineSecret('FINDI_SQL_PASSWORD');
export const neonDatabaseUrl = defineSecret('DATABASE_URL');

/** Bind only the active database provider's secret in functions, jobs and triggers. */
export function databaseSecrets(): SecretParam[] {
  return sqlProvider() === 'neon' ? [neonDatabaseUrl] : [sqlPassword];
}

let pending: Promise<pg.Pool> | undefined;
export async function sqlPool(): Promise<pg.Pool> {
  if (!pending) pending = (async () => {
    let connection: pg.PoolConfig;
    if (sqlProvider() === 'neon') {
      connection = neonPoolOptions(neonDatabaseUrl.value());
    } else {
      const config = sqlConfig();
      const password = sqlPassword.value();
      if (!password) throw new Error('SQL_PASSWORD_NOT_CONFIGURED');
      const options = await new Connector().getOptions({instanceConnectionName: config.instance, ipType: IpAddressTypes.PUBLIC});
      connection = {...options, database:config.database, user:config.user, password};
    }
    const pool = new pg.Pool({...connection, max:4, idleTimeoutMillis:30_000, connectionTimeoutMillis:15_000});
    // Driver errors may carry credentials in arbitrary fields; emit only a fixed code.
    pool.on('error', () => console.error('SQL_POOL_ERROR'));
    return pool;
  })();
  try { return await pending; } catch (error) { pending=undefined; throw error; }
}
