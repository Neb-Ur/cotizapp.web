import test from 'node:test';import assert from 'node:assert/strict';
import {preserveServerConfig} from '../scripts/lib/server-config.mjs';
test('CI preserves SQL, R2 and pilot connections without copying secret credentials',()=>{
 const existing={USE_SQL_DATABASE:'true',PILOT_STORES_ENABLED:'true',IMAGE_STORAGE_PROVIDER:'r2',R2_ACCOUNT_ID:'public-account-id',R2_BUCKET:'bucket',R2_PUBLIC_BASE_URL:'https://images.example.invalid',ALLOWED_ORIGINS:'https://example.invalid',REQUIRE_ADMIN_MFA:'true',FINDI_SQL_PASSWORD:'private-test-value',FINDI_R2_SECRET_ACCESS_KEY:'private-test-value'};
 const next=preserveServerConfig(existing,'test-project');
 for(const key of Object.keys(existing).filter(k=>!k.startsWith('FINDI_')))assert.equal(next[key],existing[key],key);
 assert.equal(next.FINDI_SQL_PASSWORD,undefined);assert.equal(next.FINDI_R2_SECRET_ACCESS_KEY,undefined);
});
test('SQL selector requires a valid explicit override and otherwise retains deployed authority',()=>{
 assert.equal(preserveServerConfig({USE_SQL_DATABASE:'true'},'test').USE_SQL_DATABASE,'true');
 assert.equal(preserveServerConfig({USE_SQL_DATABASE:'true'},'test','false').USE_SQL_DATABASE,'false');
 assert.throws(()=>preserveServerConfig({USE_SQL_DATABASE:'true'},'test','1'));
});
test('Neon and compact selectors survive deploy without adding Cloud SQL defaults or exposing URLs',()=>{
 const existing={USE_SQL_DATABASE:'true',SQL_PROVIDER:'neon',SQL_SCHEMA_VARIANT:'compact',SQL_REPLICATION_ENABLED:'false',DATABASE_URL:'postgresql://private:password@private.example/db',COTIZAPP_DATABASE_URL:'private',COTIZAPP_API_TOKEN:'private',COTIZAPP_FEATURE:'enabled',R2_BUCKET:'images',PILOT_STORES_ENABLED:'false'};
 const next=preserveServerConfig(existing,'test-project');
 for(const key of ['USE_SQL_DATABASE','SQL_PROVIDER','SQL_SCHEMA_VARIANT','SQL_REPLICATION_ENABLED','COTIZAPP_FEATURE','R2_BUCKET','PILOT_STORES_ENABLED'])assert.equal(next[key],existing[key],key);
 for(const key of ['DATABASE_URL','COTIZAPP_DATABASE_URL','COTIZAPP_API_TOKEN','SQL_INSTANCE_CONNECTION_NAME','SQL_DATABASE_NAME','SQL_DATABASE_USER'])assert.equal(next[key],undefined,key);
 assert.doesNotMatch(JSON.stringify(next),/private|postgresql:/);
});
test('deployed selectors reject unknown values rather than silently falling back to Cloud SQL',()=>{
 assert.throws(()=>preserveServerConfig({SQL_PROVIDER:'postgres'},'test'),/SQL_PROVIDER/);
 assert.throws(()=>preserveServerConfig({SQL_PROVIDER:'neon',SQL_SCHEMA_VARIANT:'unknown'},'test'),/SQL_SCHEMA_VARIANT/);
 assert.equal(preserveServerConfig({},'test').SQL_PROVIDER,'cloudsql');
});
