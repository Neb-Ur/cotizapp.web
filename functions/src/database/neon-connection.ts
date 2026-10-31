import type pg from 'pg';

/** Parse explicitly so connection-string SSL parameters cannot override verified TLS. */
export function neonPoolOptions(value: string): pg.PoolConfig {
  if (!value?.trim()) throw new Error('NEON_DATABASE_URL_NOT_CONFIGURED');
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !url.hostname || url.hostname.includes('%') || url.hash
      || !url.username || !url.password || url.pathname.length <= 1) {
      throw new Error('NEON_DATABASE_URL_INVALID');
    }
    const sslMode = url.searchParams.get('sslmode');
    const ssl = url.searchParams.get('ssl');
    if ((sslMode && !['require', 'verify-full'].includes(sslMode))
      || (ssl !== null && !['true', '1'].includes(ssl))
      || ['sslcert', 'sslkey', 'sslrootcert'].some(key => url.searchParams.has(key))) {
      throw new Error('NEON_DATABASE_TLS_REQUIRED');
    }
    const port = url.port ? Number(url.port) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('NEON_DATABASE_URL_INVALID');
    return {
      host: url.hostname.replace(/^\[(.*)\]$/, '$1'),
      port,
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: true },
      enableChannelBinding: true,
      ...(url.searchParams.has('options') ? { options: url.searchParams.get('options')! } : {}),
      ...(url.searchParams.has('application_name') ? { application_name: url.searchParams.get('application_name')! } : {})
    };
  } catch (error) {
    // URL parser exceptions can include the complete credential-bearing input.
    const code = error instanceof Error && error.message === 'NEON_DATABASE_TLS_REQUIRED'
      ? 'NEON_DATABASE_TLS_REQUIRED' : 'NEON_DATABASE_URL_INVALID';
    throw new Error(code);
  }
}
