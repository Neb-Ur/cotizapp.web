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
