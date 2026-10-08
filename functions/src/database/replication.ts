import { PostgresDatabase, type ConnectionPool } from './postgres.js';
import { mappingFor, quote } from './codec.js';
import type { Data } from './port.js';
export function firestoreVersion(timestamp:{seconds:number;nanoseconds:number}):string {return String(BigInt(timestamp.seconds)*1_000_000_000n+BigInt(timestamp.nanoseconds));}
export async function replicateDocument(pool:ConnectionPool,collection:string,id:string,data:Data|null,version:string):Promise<boolean>{
 mappingFor(collection);
 const sql=new PostgresDatabase(pool,false);
 return sql.runTransaction(async tx=>{
  // The row below serializes replay and ignores out-of-order/repeated events.
  const internal=tx as any;
  const client=internal.client;
  const state=await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql' FOR SHARE");
  if(state.rows[0]?.status==='active')return false;
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[collection+'/'+id]);
  const latest=await client.query('SELECT source_version FROM findi.source_replication_versions WHERE collection_name=$1 AND document_id=$2',[collection,id]);
  if(latest.rows.length&&BigInt(latest.rows[0].source_version)>=BigInt(version))return false;
  const ref=sql.collection(collection).doc(id);
  if(data)tx.set(ref,data);else tx.delete(ref);
  // SQL transaction flushes the mutations only after this callback returns.
  await client.query('INSERT INTO findi.source_replication_versions(collection_name,document_id,source_version,deleted) VALUES($1,$2,$3,$4) ON CONFLICT(collection_name,document_id) DO UPDATE SET source_version=EXCLUDED.source_version,deleted=EXCLUDED.deleted,replicated_at=now()',[collection,id,version,data===null]);
  return true;
 });
}
