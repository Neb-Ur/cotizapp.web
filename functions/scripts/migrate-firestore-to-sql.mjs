import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Firestore} from '@google-cloud/firestore';
import {cloudAuth,secretValue,cloudPool,projectId,requireApply} from './lib/sql-cloud.mjs';
import {writeDocument,ensureAgreementDocument,mappingByCollection} from '../lib/database/codec.js';
import {firestoreVersion} from '../lib/database/replication.js';
const order=['users','categories','subcategories','families','brands','familyDefinitions','masterProducts','masterAttributes','stores','storeProducts','storeAgreements','projects','productRequests','contactRequests','consentRecords','marketingSuppressions','intellectualPropertyReports','priceReports','priceHistory','privacyRequests','deletionReceipts','adminAuditLogs','securityIncidents','governanceEvidence','storeMetrics','storeDailyAnalytics','analyticsJobs','publicCache'];
const stable=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
async function parallel(items,callback,workers=12){let index=0;await Promise.all(Array.from({length:workers},async()=>{while(index<items.length){const item=items[index++];await callback(item);}}));}
async function main(){
 const verifyOnly=process.argv.includes('--verify-only');if(!verifyOnly)requireApply();
 const auth=await cloudAuth(),firestore=new Firestore({projectId,authClient:auth});
 const password=await secretValue(auth,'FINDI_SQL_MIGRATION_PASSWORD');
 const {pool,close}=await cloudPool(auth,'findi_migration',password);
 const mappings=JSON.parse(await readFile(new URL('../src/database/source-mapping.json',import.meta.url),'utf8'));
 try{
  const control=(await pool.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql'")).rows[0];
  if(control?.status==='active')throw new Error('SQL está activo: no volver a importar desde Firestore.');
  if(!verifyOnly)await pool.query("INSERT INTO findi.database_migration_state(id,status,source_project) VALUES('firestore-to-sql','copying',$1) ON CONFLICT(id) DO UPDATE SET status='copying',updated_at=now()",[projectId]);
  if(!verifyOnly)await ensureAgreementDocument(pool);
  const backup={},manifest={};
  for(const key of order){
   const collection=mappings[key].sourceCollection,snapshot=await firestore.collection(collection).get();
   const documents=snapshot.docs.map(doc=>({id:doc.id,data:doc.data(),version:firestoreVersion(doc.updateTime)}));
   backup[key]=documents;
   if(!verifyOnly)await parallel(documents,async doc=>{
    const client=await pool.connect();try{
     await client.query('BEGIN');
     await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[collection+'/'+doc.id]);
     const previous=await client.query('SELECT source_version FROM findi.source_replication_versions WHERE collection_name=$1 AND document_id=$2',[collection,doc.id]);
     if(!previous.rows.length||BigInt(previous.rows[0].source_version)<BigInt(doc.version)){
      await writeDocument(client,collection,doc.id,doc.data);
      await client.query('INSERT INTO findi.source_replication_versions(collection_name,document_id,source_version) VALUES($1,$2,$3) ON CONFLICT(collection_name,document_id) DO UPDATE SET source_version=EXCLUDED.source_version,deleted=false,replicated_at=now()',[collection,doc.id,doc.version]);
     }
     await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   });
   manifest[key]={count:documents.length,sha256:hash(documents.map(d=>({id:d.id,data:d.data})).sort((a,b)=>a.id.localeCompare(b.id)))};
   console.log(key,documents.length,verifyOnly?'checking':'copied');
  }
  if(!verifyOnly){await mkdir(new URL('../../tmp/sql-migration/',import.meta.url),{recursive:true});await writeFile(new URL('../../tmp/sql-migration/backup-'+Date.now()+'.json',import.meta.url),JSON.stringify({projectId,collections:backup}),{mode:0o600,flag:'wx'});}
  const {PostgresDatabase}=await import('../lib/database/postgres.js');const sql=new PostgresDatabase(pool,false);
  const issues=[];
  for(const key of order){
   if(key==='publicCache')continue; // rebuilt derivatives and revisions can change during sync
   const collection=mappings[key].sourceCollection;
   const fresh=await firestore.collection(collection).get();
   const freshDocs=fresh.docs.map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
   manifest[key]={count:freshDocs.length,sha256:hash(freshDocs)};
   const sqlSnapshot=await sql.collection(collection).get();
   const sqlDocs=sqlSnapshot.docs.map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));
   const sqlHash=hash(sqlDocs);
   if(sqlDocs.length!==manifest[key].count||sqlHash!==manifest[key].sha256)issues.push({collection,count:manifest[key].count,sqlCount:sqlDocs.length});
  }
  if(issues.length){console.error(JSON.stringify({status:'not_verified',issues}));throw new Error('La conciliación no coincide; reintentar después de drenar la réplica.');}
  await pool.query("UPDATE findi.database_migration_state SET status='verified',verified_at=now(),manifest=$1,updated_at=now() WHERE id='firestore-to-sql' AND status<>'active'",[JSON.stringify(manifest)]);
  console.log(JSON.stringify({verified:true,projectId,collections:Object.keys(manifest).length,documents:Object.values(manifest).reduce((n,m)=>n+m.count,0),USE_SQL_DATABASE:false}));
 }finally{await close();await firestore.terminate();}
}
main().catch(error=>{console.error('SQL_MIGRATION_FAILED',error.response?.data?.error?.message||error.code||error.message);process.exitCode=1;});
