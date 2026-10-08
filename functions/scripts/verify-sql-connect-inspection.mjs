import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeApp} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import {cloudAuth,cloudPool,secretValue,projectId} from './lib/sql-cloud.mjs';
const manifest=JSON.parse(await readFile(new URL('../../dataconnect/inspection-manifest.json',import.meta.url),'utf8'));
const auth=await cloudAuth();const {pool,close}=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {
 const actual=(await pool.query("SELECT schemaname||'.'||tablename AS name FROM pg_tables WHERE schemaname IN ('findi','findi_migration') OR (schemaname='public' AND tablename='findi_schema_migrations') ORDER BY 1")).rows.map(r=>r.name);
 assert.deepEqual(manifest.map(m=>m.table).sort(),actual);
 const app=initializeApp({projectId,credential:{getAccessToken:async()=>({access_token:(await auth.getAccessToken()).token,expires_in:600})}},'complete-inspection');
 const connector=getDataConnect({serviceId:'cotizapp-d71c8-service',location:'us-east4',connector:'findi-admin'},app);
 for(const item of manifest){
  const result=await connector.executeQuery(item.query);
  const rows=result.data[item.root];assert.ok(Array.isArray(rows),item.model);
  const expected=(await pool.query(`SELECT count(*)::int n FROM ${item.table}`)).rows[0].n;
  assert.equal(rows.length,Math.min(expected,20),item.model);
  console.log('Verified',item.model,'rows',rows.length);
 }
 // None of the added queries may be called anonymously from a browser.
 const denied=await fetch(`https://firebasedataconnect.googleapis.com/v1/projects/${projectId}/locations/us-east4/services/cotizapp-d71c8-service/connectors/findi-admin:executeQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationName:manifest.find(m=>m.table==='findi.users').query})});
 assert.ok([401,403].includes(denied.status),'Anonymous inspection must be denied');
 const reader='firebasereader_cotizapp-d71c8-database_public';
 const privileges=(await pool.query("SELECT has_table_privilege($1,'findi.users','SELECT') AS private_table,has_table_privilege($1,'findi_inspection.users','SELECT') AS inspection,has_table_privilege($1,'findi_inspection.users','UPDATE') AS can_update",[reader])).rows[0];
 assert.deepEqual(privileges,{private_table:false,inspection:true,can_update:false});
 console.log(JSON.stringify({verifiedModels:manifest.length,anonymousStatus:denied.status,privileges}));
}finally{await close();}
