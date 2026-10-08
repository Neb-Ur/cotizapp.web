import {cloudAuth,secretValue,cloudPool} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getDataConnect} from 'firebase-admin/data-connect';
import assert from 'node:assert/strict';
async function main(){
 const auth=await cloudAuth();const password=await secretValue(auth,'FINDI_SQL_PASSWORD');const {pool,close}=await cloudPool(auth,'findi_runtime',password,4);
 try{
  const sql=new PostgresDatabase(pool,true),products=await sql.collection('productosMaestro').get();assert.equal(products.size,856);
  const columns=await pool.query('SELECT count(*)::int n FROM findi.products p JOIN findi.families f ON f.id=p.family_id JOIN findi.subcategories s ON s.id=f.subcategory_id JOIN findi.categories c ON c.id=s.category_id');assert.equal(columns.rows[0].n,856);
  const types=await pool.query('SELECT count(*)::int n FROM findi.product_attributes');assert.equal(types.rows[0].n,1047);
  const role=(await pool.query("SELECT pg_has_role(current_user,'cloudsqlsuperuser','MEMBER') AS superuser,pg_has_role(current_user,'findi_backend','MEMBER') AS backend")).rows[0];assert.equal(role.superuser,false);assert.equal(role.backend,true);
  const client=await pool.connect();try{await client.query('BEGIN');await assert.rejects(client.query('CREATE TABLE findi.forbidden_runtime_table(id text)'),e=>e.code==='42501');await client.query('ROLLBACK');}finally{client.release();}
  const fullOwner=(await pool.query('SELECT u.id FROM findi.users u JOIN findi.quotations q ON q.owner_id=u.id GROUP BY u.id,u.quotation_limit HAVING count(*)>=u.quotation_limit LIMIT 1')).rows[0];
  if(fullOwner){
   const first=await pool.connect(),second=await pool.connect();
   try{
    await first.query('BEGIN');await first.query('SELECT id FROM findi.users WHERE id=$1 FOR UPDATE',[fullOwner.id]);
    await second.query('BEGIN');await second.query("SET LOCAL lock_timeout='500ms'");
    await assert.rejects(second.query("INSERT INTO findi.quotations(id,owner_id,name) VALUES('validation-rollback-only',$1,'Validación transitoria')",[fullOwner.id]),e=>e.code==='55P03');await second.query('ROLLBACK');
    await assert.rejects(first.query("INSERT INTO findi.quotations(id,owner_id,name) VALUES('validation-rollback-only',$1,'Validación transitoria')",[fullOwner.id]),e=>e.code==='23514'&&e.message.includes('COTIZACION_LIMIT_REACHED'));await first.query('ROLLBACK');
    assert.equal((await pool.query("SELECT count(*)::int n FROM findi.quotations WHERE id='validation-rollback-only'")).rows[0].n,0);
    console.log('PostgreSQL concurrency and quotation limit verified; all validation writes rolled back');
   }finally{await first.query('ROLLBACK');await second.query('ROLLBACK');first.release();second.release();}
  }
  // Exercise the actual public API with the SQL repository without activating the deployment.
  if(!getApps().length)initializeApp({projectId:'cotizapp-d71c8'});
  const inspectionApp=initializeApp({projectId:'cotizapp-d71c8',credential:{getAccessToken:async()=>({access_token:(await auth.getAccessToken()).token,expires_in:600})}},'sql-inspection');
  const {db}=await import('../lib/lib/firebase.js');for(const name of ['collection','batch','runTransaction'])db[name]=sql[name].bind(sql);
  const {api}=await import('../lib/index.js');const {createServer}=await import('node:http');const server=createServer(api);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const base=`http://127.0.0.1:${server.address().port}`;
   for(const path of ['/api/config','/api/catalogo-publico','/sitemap.xml']){
    const res=await fetch(base+path);if(path==='/api/catalogo-publico'&&res.status===404)continue;assert.equal(res.status,200,path);console.log('SQL API',path,res.status);
   }
  }finally{await new Promise(resolve=>server.close(resolve));}
  try{
   const connector=getDataConnect({serviceId:'cotizapp-d71c8-service',location:'us-east4',connector:'findi-admin'},inspectionApp);
   const result=await connector.executeQuery('InspectCatalog');assert.ok(result.data.catalogProducts.length);console.log('SQL Connect admin query',result.data.catalogProducts.length);
  }catch(error){console.error('SQL_CONNECT_QUERY_FAILED',error.message);throw error;}
  console.log(JSON.stringify({verified:true,products:products.size,attributes:types.rows[0].n,role,DDLBlocked:true}));
 }finally{await close();}
}
main().catch(error=>{console.error('SQL_RUNTIME_VERIFY_FAILED',error.code||error.message);process.exitCode=1;});
