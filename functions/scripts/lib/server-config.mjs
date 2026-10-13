const preservedKeys = new Set(['ALLOWED_ORIGINS','REQUIRE_ADMIN_MFA','VEHICLE_APPLICATIONS_ENABLED','VEHICLE_APPLICATION_PILOT_STORE_IDS','PILOT_STORES_ENABLED','IMAGE_STORAGE_PROVIDER','R2_ACCOUNT_ID','R2_BUCKET','R2_PUBLIC_BASE_URL']);
export function preserveServerConfig(existing,project,requestedSql) {
 const selected=requestedSql||existing.USE_SQL_DATABASE||'false';
 if(!['true','false'].includes(selected))throw new Error('USE_SQL_DATABASE must be true or false');
 const preserved=Object.fromEntries(Object.entries(existing).filter(([key])=>preservedKeys.has(key)||key.startsWith('COTIZAPP_')));
 return {...preserved,USE_SQL_DATABASE:selected,SQL_REPLICATION_ENABLED:existing.SQL_REPLICATION_ENABLED||'false',SQL_INSTANCE_CONNECTION_NAME:existing.SQL_INSTANCE_CONNECTION_NAME||`${project}:us-east4:cotizapp-d71c8-instance`,SQL_DATABASE_NAME:existing.SQL_DATABASE_NAME||'cotizapp-d71c8-database',SQL_DATABASE_USER:existing.SQL_DATABASE_USER||'findi_runtime'};
}
