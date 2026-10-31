import {readFile,mkdir,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {cloudAuth,cloudPool,secretValue} from './lib/sql-cloud.mjs';
import {HISTORICAL_MIGRATIONS,applySchemaMigrations,configureRuntimeRole} from './lib/schema-migrations.mjs';
import {snapshotSelectedData,applySelectedData,hashDtoDocuments} from './lib/neon-data-transfer.mjs';
import {neonPoolOptions} from '../lib/database/neon-connection.js';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {catalogLandings,seoProductSlug} from '../lib/domain/catalog-seo.js';
import {preserveServerConfig} from './lib/server-config.mjs';
import {assertNeonTarget} from './lib/neon-target.mjs';

const targetProject='crimson-credit-77789114';
const sourceProject='cotizapp-d71c8';
const args=process.argv.slice(2);
const argument=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const branch=argument('--branch');
const root=new URL('../../',import.meta.url);
const migrationFiles=[...HISTORICAL_MIGRATIONS,'025-compact-schema.sql'];
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
const envText=values=>Object.entries(values).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n';
const run=promisify(execFile);

async function assertTargetEndpoint(directOptions){
 const read=async parameters=>JSON.parse((await run('neon',parameters,{maxBuffer:5*1024*1024})).stdout);
 const branchInfo=await read(['branches','get',branch,'--project-id',targetProject,'--output','json']);
 const info=await read(['api',`/projects/${targetProject}/endpoints`,'--output','json']);
 const pooled=neonPoolOptions(process.env.DATABASE_URL);
 assertNeonTarget({projectId:targetProject,branch,branchInfo,endpoints:info.endpoints,directOptions,pooledOptions:pooled});
}

async function writeSecretFile(path,content){await writeFile(path,content,{mode:0o600});await chmod(path,0o600);}

async function sourceConnection(){
 const auth=await cloudAuth();
 const description=await auth.request({url:`https://cloudfunctions.googleapis.com/v2/projects/${sourceProject}/locations/southamerica-west1/functions/api`});
 const serverConfig=description.data.serviceConfig?.environmentVariables||{};
 const result=await cloudPool(auth,'findi_migration',await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD'),1);
 try{return {...result,serverConfig,client:await result.pool.connect()};}catch(error){await result.close();throw error;}
}

async function pauseSource(client,paused){
 await client.query('BEGIN');
 try{
  // Exclusive update drains the shared locks held by every source write txn.
  const row=await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql' FOR UPDATE");
  if(row.rows[0]?.status!=='active')throw new Error('SOURCE_NOT_ACTIVE');
  await client.query("UPDATE findi.database_migration_state SET manifest=jsonb_set(manifest,'{writesPaused}',$1::jsonb),updated_at=now() WHERE id='firestore-to-sql'",[JSON.stringify(paused)]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
}

async function rebuildDerived(client){
 const database=new PostgresDatabase({connect:async()=>({query:client.query.bind(client),release(){}})},false);
 const documents=async collection=>(await database.collection(collection).get()).docs.map(doc=>({id:doc.id,...doc.data()}));
 const loaded=[];for(const collection of ['productosMaestro','categorias','subcategorias','familias','marcas'])loaded.push(await documents(collection));
 const [products,categories,subcategories,families,brands]=loaded;
 const active=products.filter(product=>product.estado!=='inactivo'&&product.esPrueba!==true);
 const names=rows=>new Map(rows.map(row=>[row.id,row.nombre]));
 const cats=names(categories),subs=names(subcategories),fams=names(families);
 await client.query('BEGIN');
 try{
  await client.query('UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now()');
  const revision=(await client.query("SELECT revision FROM findi.catalog_revisions WHERE scope='static'")).rows[0].revision;
  await client.query('DELETE FROM findi.catalog_search_documents');
  const rows=active.map(product=>({product_id:product.id,normalized_text:normalize([product.nombre,product.marca,product.tipoProducto,cats.get(product.categoriaId),subs.get(product.subcategoriaId),fams.get(product.familiaId)].filter(Boolean).join(' ')),version:revision}));
  await client.query("INSERT INTO findi.catalog_search_documents(product_id,normalized_text,search_vector,version,updated_at) SELECT product_id,normalized_text,to_tsvector('simple',normalized_text),version,now() FROM jsonb_to_recordset($1::jsonb) AS x(product_id text,normalized_text text,version bigint)",[JSON.stringify(rows)]);
  await client.query('DELETE FROM findi.seo_routes');
  const routes=active.map(product=>({path:'/productos/'+seoProductSlug(product,products),product_id:product.id}));
  for(const page of catalogLandings([products,categories,subcategories,families,brands]))routes.push({path:page.path,...(page.filters.marcaId?{brand_id:page.filters.marcaId}:page.filters.familia?{family_id:page.filters.familia}:{category_id:page.filters.categoria})});
  await client.query('INSERT INTO findi.seo_routes(path,product_id,category_id,family_id,brand_id) SELECT path,product_id,category_id,family_id,brand_id FROM jsonb_to_recordset($1::jsonb) AS x(path text,product_id text,category_id text,family_id text,brand_id text) ON CONFLICT(path) DO NOTHING',[JSON.stringify(routes)]);
  await client.query('COMMIT');
  return {searchDocuments:rows.length,seoRoutes:routes.length};
 }catch(error){await client.query('ROLLBACK');throw error;}
}

async function main(){
 if(!args.includes('--apply')||process.env.CONFIRM_NEON_PROJECT_ID!==targetProject)throw new Error('NEON_APPLY_CONFIRMATION_REQUIRED');
 if(!branch||!['production','migration-validation-20261031'].includes(branch))throw new Error('NEON_TARGET_BRANCH_INVALID');
 const source=await sourceConnection();
 let pausedByThisRun=false;
 let succeeded=false;
 try{
  if(args.includes('--resume-source')){await pauseSource(source.client,false);console.log('Source writes resumed.');return;}
  if(process.env.NEON_BRANCH!==branch)throw new Error('NEON_ENV_BRANCH_MISMATCH');
  const direct=process.env.DATABASE_URL_UNPOOLED;
  if(!direct)throw new Error('NEON_DIRECT_URL_REQUIRED');
  const options=neonPoolOptions(direct);
  if(!options.host.endsWith('.neon.tech')||options.host.includes('-pooler'))throw new Error('NEON_DIRECT_ENDPOINT_REQUIRED');
  await assertTargetEndpoint(options);
  if(branch==='production'&&!args.includes('--pause-source'))throw new Error('FINAL_CUTOVER_REQUIRES_SOURCE_PAUSE');
  if(args.includes('--pause-source')){
   if(branch!=='production')throw new Error('SOURCE_PAUSE_ONLY_FOR_FINAL_CUTOVER');
   const config=await fetch('https://trovio.cl/api/config',{signal:AbortSignal.timeout(30000)}).then(response=>response.json());
   if(config.data?.database?.writesManaged!==true||config.data.database.provider!=='cloudsql')throw new Error('DEPLOY_WRITE_GUARD_BEFORE_PAUSING_SOURCE');
   await pauseSource(source.client,true);pausedByThisRun=true;
   console.log('Source writes paused; in-flight write transactions drained.');
  }
  const snapshot=await snapshotSelectedData(source.client);
  if(branch==='production'&&JSON.parse(snapshot.sourceState).manifest?.writesPaused!==true)throw new Error('SOURCE_WRITE_PAUSE_NOT_VERIFIED');
  await mkdir(new URL('tmp/neon-migration/',root),{recursive:true});
  const prefix=new URL(`tmp/neon-migration/${branch}-${Date.now()}`,root);
  await writeSecretFile(new URL(prefix+'.snapshot.json'),JSON.stringify(snapshot));
  const pool=new pg.Pool({...options,max:1,connectionTimeoutMillis:30000});
  const client=await pool.connect().catch(async error=>{await pool.end();throw error;});
  try{
   const existing=(await client.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname='findi'")).rows[0].n;
   if(existing)throw new Error('NEON_TARGET_MUST_BE_EMPTY');
   await applySchemaMigrations(client,{onApplied:version=>console.log('Applied',version)});
   const copied=await applySelectedData(client,snapshot);
   await client.query("INSERT INTO findi.database_migration_state(id,status,source_project,verified_at,manifest) VALUES('firestore-to-sql','active',$1,now(),$2::jsonb)",[sourceProject,JSON.stringify({kind:'neon-operational-baseline',sourceProject,targetProject,branch,tables:snapshot.manifest,dtos:snapshot.dtoManifest})]);
   await applySchemaMigrations(client,{migrations:migrationFiles,onApplied:version=>console.log('Applied',version)});
   process.env.SQL_SCHEMA_VARIANT='compact';
   const database=new PostgresDatabase({connect:async()=>({query:client.query.bind(client),release(){}})},false);
   for(const [collection,expected] of Object.entries(snapshot.dtoManifest)){
    const rows=(await database.collection(collection).get()).docs.map(doc=>({id:doc.id,data:doc.data()}));
    if(rows.length!==expected.count||hashDtoDocuments(rows)!==expected.sha256)throw new Error('NEON_DTO_HASH_MISMATCH:'+collection);
   }
   console.log('PASS exact source/Neon API document counts and hashes.');
   const derived=await rebuildDerived(client);
   const password=randomBytes(36).toString('base64url');
   const role='findi_runtime';
   await configureRuntimeRole(client,{role,password,provider:'neon'});
   const runtime=new URL(process.env.DATABASE_URL);runtime.username=role;runtime.password=password;
   const runtimeDirect=new URL(direct);runtimeDirect.username=role;runtimeDirect.password=password;
   const runtimeFile=new URL(`tmp/neon-migration/${branch}.runtime.env`,root);
   await writeSecretFile(runtimeFile,envText({...preserveServerConfig({...source.serverConfig,SQL_PROVIDER:'neon',SQL_SCHEMA_VARIANT:'compact',SQL_REPLICATION_ENABLED:'false'},sourceProject),DATABASE_URL:runtime.href,DATABASE_URL_UNPOOLED:runtimeDirect.href,NEON_BRANCH:branch,USE_SQL_DATABASE:'true'}));
   const summary={targetProject,branch,copied,derived,sourceWritesPaused:pausedByThisRun,dtoHashesVerified:true,excludedSource:snapshot.excludedSource,migrations:migrationFiles.length};
   await writeSecretFile(new URL(prefix+'.report.json'),JSON.stringify(summary,null,2));
   console.log(JSON.stringify({targetProject,branch,migrations:summary.migrations,dtoHashesVerified:true,counts:Object.fromEntries(Object.entries(copied.tables).map(([table,value])=>[table,value.count])),derived,sourceWritesPaused:pausedByThisRun}));
   console.log('Restricted runtime environment written under tmp/neon-migration (not versioned).');
   succeeded=true;
  }finally{client.release();await pool.end();}
 }finally{
  if(pausedByThisRun&&!succeeded){await pauseSource(source.client,false);console.log('Migration failed: source writes automatically resumed.');}
  source.client.release();await source.close();
 }
}
main().catch(error=>{console.error('NEON_MIGRATION_FAILED',error.code||error.message);process.exitCode=1;});
