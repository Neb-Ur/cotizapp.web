const preservedKeys = new Set(['ALLOWED_ORIGINS','REQUIRE_ADMIN_MFA','PILOT_STORES_ENABLED','IMAGE_STORAGE_PROVIDER','R2_ACCOUNT_ID','R2_BUCKET','R2_PUBLIC_BASE_URL']);
const secretKey = /(?:PASSWORD|SECRET|TOKEN|PRIVATE_KEY|CREDENTIAL|DATABASE_URL|CONNECTION_STRING|DSN)/i;
export function preserveServerConfig(existing,project,requestedSql) {
 const selected=requestedSql||existing.USE_SQL_DATABASE||'false';
 if(!['true','false'].includes(selected))throw new Error('USE_SQL_DATABASE must be true or false');
 const provider=existing.SQL_PROVIDER||'cloudsql';
 if(!['cloudsql','neon'].includes(provider))throw new Error('SQL_PROVIDER must be cloudsql or neon');
 const variant=existing.SQL_SCHEMA_VARIANT;
 if(variant!==undefined&&!['legacy','compact'].includes(variant))throw new Error('SQL_SCHEMA_VARIANT must be legacy or compact');
 const preserved=Object.fromEntries(Object.entries(existing).filter(([key])=>!secretKey.test(key)&&(preservedKeys.has(key)||key.startsWith('COTIZAPP_'))));
 const config={...preserved,USE_SQL_DATABASE:selected,SQL_PROVIDER:provider,SQL_REPLICATION_ENABLED:existing.SQL_REPLICATION_ENABLED||'false'};
 if(variant!==undefined)config.SQL_SCHEMA_VARIANT=variant;
 const defaults=provider==='cloudsql'?{SQL_INSTANCE_CONNECTION_NAME:`${project}:us-east4:cotizapp-d71c8-instance`,SQL_DATABASE_NAME:'cotizapp-d71c8-database',SQL_DATABASE_USER:'findi_runtime'}:{};
 for(const key of ['SQL_INSTANCE_CONNECTION_NAME','SQL_DATABASE_NAME','SQL_DATABASE_USER'])if(existing[key]||defaults[key])config[key]=existing[key]||defaults[key];
 return config;
}
