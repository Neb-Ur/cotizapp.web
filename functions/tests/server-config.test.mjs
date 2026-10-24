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
