import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { mappingByCollection } from '../database/codec.js';
import { useSqlDatabase } from '../database/config.js';
import { sqlPassword, sqlPool } from '../database/pool.js';
import { firestoreVersion, replicateDocument } from '../database/replication.js';
// One stream covers the 29 known collections. Unknown collections are ignored.
// Enabled only while Firestore is the authority; never overwrite active SQL data.
export const replicateFirestoreToSql = onDocumentWritten({document:'{collectionName}/{documentId}',region:'us-east4',secrets:[sqlPassword],retry:true,maxInstances:4,concurrency:4}, async event=>{
 if(useSqlDatabase()||process.env['SQL_REPLICATION_ENABLED']!=='true')return;
 const {collectionName,documentId}=event.params;
 if(!mappingByCollection.has(collectionName)||!event.data)return;
 const pool=await sqlPool();
 const connection=await pool.connect();
 try {
  const state=await connection.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql'");
  if(!['copying','verified'].includes(state.rows[0]?.status))return;
 }finally{connection.release();}
 const after=event.data.after;
 const timestamp=after.exists?after.updateTime:event.data.before.updateTime;
 // CloudEvent time orders deletes after the last live revision.
 const version=after.exists?firestoreVersion(timestamp!):String(BigInt(Date.parse(event.time))*1_000_000n);
 await replicateDocument(pool,collectionName,documentId,after.exists?after.data()!:null,version);
});
