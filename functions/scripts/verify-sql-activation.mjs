// Production checks only: no fabricated accounts, offers or quotations.
import assert from 'node:assert/strict';
import {cloudAuth,cloudRequest,cloudPool,secretValue,projectId} from './lib/sql-cloud.mjs';
const auth=await cloudAuth();
for(const [region,name]of [['southamerica-west1','api'],['southamerica-east1','refreshStoreDailyAnalytics'],['us-east4','replicateFirestoreToSql']]){
 const fn=await cloudRequest(auth,`https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions/${name}`);
 assert.equal(fn.state,'ACTIVE',name);assert.equal(fn.serviceConfig.environmentVariables.USE_SQL_DATABASE,'true',name);
 console.log('PostgreSQL enabled:',name);
}
const base='https://cotizapp-d71c8.web.app';const timings=[];
async function probe(path){
 const start=performance.now();const response=await fetch(base+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(120000)});
 const body=await response.text();const ms=Math.round(performance.now()-start);
 assert.equal(response.status,200,`${path}: ${response.status} ${body.slice(0,200)}`);timings.push({path,ms});
 return JSON.parse(body);
}
await probe('/api/config'); // First request performs the final locked reconciliation.
const {pool,close}=await cloudPool(auth,'findi_runtime',await secretValue(auth,'FINDI_SQL_PASSWORD'),1);
try {
 const state=(await pool.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql'")).rows[0];assert.equal(state.status,'active');
 assert.equal((await pool.query('SELECT count(*)::int n FROM findi.source_replication_versions')).rows[0].n,0);
 const catalog=(await probe('/api/catalogo-publico?v=sql-activation-'+Date.now())).data;
 const expected=(await pool.query("SELECT count(*)::int n FROM findi.products WHERE status='activo' AND deleted_at IS NULL")).rows[0].n;assert.equal(catalog.products.length,expected);
 const name=catalog.products[0].nombre;
 const detail=(await probe('/api/productos/detalle?producto='+encodeURIComponent(name))).data;assert.equal(detail.productoMaestro.nombre,name);
 const index=(await probe('/api/catalogo-busqueda')).data;assert.ok(index);
 for(let i=0;i<3;i++)await probe('/api/productos/detalle?producto='+encodeURIComponent(name));
 const denied=await fetch(base+'/api/admin/usuarios');assert.equal(denied.status,401);
 console.log(JSON.stringify({activeDatabase:'PostgreSQL',products:expected,unauthenticatedAdminStatus:denied.status,timings}));
}finally{await close();}
