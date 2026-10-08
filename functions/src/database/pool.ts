import pg from 'pg';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import { sqlConfig } from './config.js';
import { defineSecret } from 'firebase-functions/params';
export const sqlPassword = defineSecret('FINDI_SQL_PASSWORD');
let pending: Promise<pg.Pool> | undefined;
export async function sqlPool(): Promise<pg.Pool> {
  if (!pending) pending = (async () => {
    const config = sqlConfig();
    const password = sqlPassword.value();
    if (!password) throw new Error('SQL_PASSWORD_NOT_CONFIGURED');
    const options = await new Connector().getOptions({instanceConnectionName: config.instance, ipType: IpAddressTypes.PUBLIC});
    const pool = new pg.Pool({...options, database:config.database, user:config.user, password, max:4, idleTimeoutMillis:30_000, connectionTimeoutMillis:15_000});
    pool.on('error', error => console.error('SQL_POOL_ERROR', error.name));
    return pool;
  })();
  try { return await pending; } catch (error) { pending=undefined; throw error; }
}
