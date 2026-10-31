export function useSqlDatabase(): boolean {
  const value = process.env['USE_SQL_DATABASE'] || 'false';
  if (!['true','false'].includes(value)) throw new Error('USE_SQL_DATABASE must be true or false');
  return value === 'true';
}
export const sqlConfig = () => ({
  instance: process.env['SQL_INSTANCE_CONNECTION_NAME'] || 'cotizapp-d71c8:us-east4:cotizapp-d71c8-instance',
  database: process.env['SQL_DATABASE_NAME'] || 'cotizapp-d71c8-database',
  user: process.env['SQL_DATABASE_USER'] || 'findi_runtime',
  serviceId: 'cotizapp-d71c8-service', location: 'us-east4'
});

export type SqlProvider = 'cloudsql' | 'neon';
export function sqlProvider(): SqlProvider {
  const value = process.env['SQL_PROVIDER'] || 'cloudsql';
  if (value !== 'cloudsql' && value !== 'neon') throw new Error('SQL_PROVIDER_INVALID');
  return value;
}

export type SqlSchemaVariant = 'legacy' | 'compact';
export function sqlSchemaVariant(): SqlSchemaVariant {
  const value = process.env['SQL_SCHEMA_VARIANT'] || 'legacy';
  if (value !== 'legacy' && value !== 'compact') throw new Error('SQL_SCHEMA_VARIANT_INVALID');
  return value;
}
