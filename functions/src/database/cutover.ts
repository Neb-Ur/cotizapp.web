import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { useSqlDatabase } from './config.js';
import { sqlPool } from './pool.js';
import { mappingByCollection,writeDocument } from './codec.js';
import { PostgresDatabase } from './postgres.js';
const stable=(value:any):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=(value:any)=>createHash('sha256').update(stable(value)??'null').digest('hex');
// Hold the shared lease until the complete Firestore operation finishes. Activation
// takes an exclusive lock, then reconciles the final source changes under that lock.
export async function acquireFirestoreWriteLease():Promise<()=>Promise<void>>{
 if(useSqlDatabase()||process.env['SQL_REPLICATION_ENABLED']!=='true')return async()=>{};
 const client=await (await sqlPool()).connect();
 try{
  await client.query('BEGIN');
  const result=await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql' FOR SHARE");
  if(result.rows[0]?.status==='active')throw new Error('DATABASE_CUTOVER_IN_PROGRESS');
  let released=false;return async()=>{if(released)return;released=true;try{await client.query('COMMIT');}finally{client.release();}};
 }catch(error){await client.query('ROLLBACK');client.release();throw error;}
}
export async function assertFirestoreWritesAllowed():Promise<void>{const release=await acquireFirestoreWriteLease();await release();}
let activated=false;
export async function activateSqlIfRequested():Promise<void>{
 if(!useSqlDatabase()||activated)return;
 const pool=await sqlPool(),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const result=await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql' FOR UPDATE");
  if(!['verified','active'].includes(result.rows[0]?.status))throw new Error('SQL_MIGRATION_NOT_VERIFIED');
  if(result.rows[0].status==='verified'){
   const firestore=getFirestore(),sql=new PostgresDatabase(pool,false);
   await reconcileFinalSource(client,firestore,sql);
   await client.query("UPDATE findi.database_migration_state SET status='active',updated_at=now() WHERE id='firestore-to-sql'");
   await client.query('DELETE FROM findi.source_replication_versions');
  }
  await client.query('COMMIT');activated=true;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

export async function reconcileFinalSource(client:import('./codec.js').SqlClient,firestore:{collection(name:string):{get():Promise<{docs:Array<{id:string;data():any}>}>}},sql:PostgresDatabase){
 const snapshots=new Map<string,Map<string,any>>();
 // Exclude derived caches and transient locks. All application source records
 // are reconciled once; normal SQL requests never consult Firestore afterwards.
 const priority=['users','categories','subcategories','families','brands','familyDefinitions','masterProducts','masterAttributes','stores','storeProducts','storeAgreements','projects','productRequests','contactRequests','consentRecords','marketingSuppressions','intellectualPropertyReports','priceReports','priceHistory','privacyRequests','deletionReceipts','adminAuditLogs','securityIncidents','governanceEvidence','storeMetrics','storeDailyAnalytics','analyticsJobs'];
 for(const [collection,mapping]of [...mappingByCollection].sort((a,b)=>priority.indexOf(a[1].key)-priority.indexOf(b[1].key))){
  if(['publicCache','projectOwnerLocks'].includes(mapping.key))continue;
  const source=await firestore.collection(collection).get();
  snapshots.set(collection,new Map(source.docs.map(doc=>[doc.id,doc.data()])));
  const existing=await sql.read(client,collection);
  const previous=new Map(existing.docs.map(doc=>[doc.id,doc.data()]));
  for(const doc of source.docs)if(hash(previous.get(doc.id))!==hash(doc.data()))await writeDocument(client,collection,doc.id,doc.data());
 }
 // Deletions run from children to parents, preserving the same tombstone rules.
 for(const [collection,source]of [...snapshots].reverse()){
  const existing=await sql.read(client,collection);
  for(const doc of existing.docs)if(!source.has(doc.id))await sql.apply(client,{kind:'delete',ref:sql.collection(collection).doc(doc.id) as any});
 }
}
