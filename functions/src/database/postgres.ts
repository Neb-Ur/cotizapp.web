import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { mappingFor, quote, writeDocument, tableColumns, type SqlClient } from './codec.js';
import type { Database, Data, DocumentReference, DocumentSnapshot, CollectionReference, Query, QuerySnapshot, WriteBatch, Transaction } from './port.js';
export interface Connection extends SqlClient { release(): void; }
export interface ConnectionPool { connect(): Promise<Connection>; }
type Filter = [string,string,any];
type Operation = {kind:'set'|'update'|'create'|'delete';ref:SqlDocument;data?:Data;merge?:boolean};
const conditions=(collection:string,filters:Filter[],params:any[])=>filters.map(([field,op,value])=>{
 if(!['==','<','<=','>','>='].includes(op))throw new Error('SQL_QUERY_OPERATOR_UNSUPPORTED');
 const mapping=mappingFor(collection),table=mapping.tables[0];
 const target=(mapping.fields as Record<string,string>)[field];
 const column=target?.startsWith(table+'.')?target.slice(table.length+1):undefined;
 if(column&&tableColumns(table).some(c=>c.column_name===column)){
  params.push(field,value);
  return `(api_payload ? $${params.length-1} AND ${quote(column)} ${op==='=='?'IS NOT DISTINCT FROM':op} $${params.length})`;
 }
 params.push(field,JSON.stringify(value));return `api_payload -> $${params.length-1} ${op==='=='?'=':op} $${params.length}::jsonb`;
});
function selection(collection:string,id?:string) {
 const mapping=mappingFor(collection),key=mapping.key,table=key==='publicCache'?'public_cache_artifacts':mapping.tables[0];
 const idColumn=key==='marketingSuppressions'?'email_hash':['storeMetrics','storeDailyAnalytics'].includes(key)?'store_id':key==='analyticsJobs'?'job_name':key==='publicCache'?'key':'id';
 return {key,table,idColumn,payload:key==='publicCache'?'payload':'api_payload',latest:['storeDailyAnalytics','analyticsJobs'].includes(key)};
}
function materialize(value:any,previous:any):any {
 // Translate only the Admin SDK's increment transform used by counters/revisions.
 if(value&&typeof value==='object'&&value.constructor?.name==='NumericIncrementTransform')return Number(previous||0)+Number(value.operand);
 if(Array.isArray(value))return value.map((v,i)=>materialize(v,previous?.[i]));
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,materialize(v,previous?.[k])]));
 if(value instanceof Date)return value.toISOString();
 if(value!==null&&typeof value==='object')throw new Error('SQL_UNSUPPORTED_VALUE_TYPE');
 if(typeof value==='number'&&!Number.isFinite(value))throw new Error('SQL_NONFINITE_VALUE');
 return value;
}
export class PostgresDatabase implements Database {
 constructor(private readonly pool:ConnectionPool,private readonly requireReady=true){}
 async withClient<T>(callback:(client:SqlClient)=>Promise<T>):Promise<T>{
  const client=await this.pool.connect();try{
   if(this.requireReady){const state=await client.query("SELECT status FROM findi.database_migration_state WHERE id='firestore-to-sql'");if(!['verified','active'].includes(state.rows[0]?.status))throw new Error('SQL_MIGRATION_NOT_VERIFIED');}
   return await callback(client);
  }finally{client.release();}
 }
 collection(name:string):CollectionReference {mappingFor(name);return new SqlCollection(this,name);}
 batch():WriteBatch{return new SqlBatch(this);}
 async runTransaction<T>(callback:(tx:Transaction)=>Promise<T>):Promise<T>{
  for(let attempt=0;attempt<5;attempt++){
   try{return await this.withClient(async client=>{
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try{const tx=new SqlTransaction(this,client);const result=await callback(tx);await tx.flush(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}
   });}catch(error){if(!['40001','40P01'].includes((error as pg.DatabaseError).code||'')||attempt===4)throw error;}
  }throw new Error('SQL_TRANSACTION_RETRY_EXHAUSTED');
 }
 async read(client:SqlClient,collection:string,id?:string,filters:Filter[]=[],limit?:number):Promise<QuerySnapshot>{
  if(mappingFor(collection).key==='projectOwnerLocks'){
   // Lock the owner row before checking the quote limit; no operational document is stored.
   if(id)await client.query('SELECT id FROM findi.users WHERE id=$1 FOR UPDATE',[id]);
   return {docs:[],size:0,empty:true};
  }
  const meta=selection(collection),params:any[]=[],clauses=[`${meta.payload} IS NOT NULL`];
  if(id!==undefined){params.push(id);clauses.push(`${quote(meta.idColumn)}=$1`);}
  if(meta.key==='masterProducts')clauses.push('deleted_at IS NULL');
  if(meta.key==='publicCache'&&filters.length){
   for(const [field,op,value]of filters){if(!['==','<'].includes(op))throw new Error('SQL_QUERY_OPERATOR_UNSUPPORTED');params.push(field,JSON.stringify(value));clauses.push(`payload -> $${params.length-1} ${op==='=='?'=':op} $${params.length}::jsonb`);}
  }else clauses.push(...conditions(collection,filters,params));
  const distinct=meta.latest?`DISTINCT ON (${quote(meta.idColumn)}) `:'';
  const sql=`SELECT ${distinct}${quote(meta.idColumn)} AS id,${meta.payload} AS data FROM findi.${quote(meta.table)} WHERE ${clauses.join(' AND ')} ORDER BY ${quote(meta.idColumn)}${meta.latest?',local_date DESC':''}${limit!==undefined?' LIMIT '+Math.max(0,Math.floor(limit)):''}`;
  const result=await client.query(sql,params);
  const docs=result.rows.map(value=>{
   const ref=new SqlDocument(this,collection,value.id),data=value.data;
   return {id:value.id,ref,exists:true,data:()=>structuredClone(data)};
  });return {docs,size:docs.length,empty:docs.length===0};
 }
 async apply(client:SqlClient,operation:Operation){
  const {ref}=operation;
  // Lock every read-modify-write, including increment counters and merge patches.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ref.path]);
  const previous=(await this.read(client,ref.collectionName,ref.id)).docs[0]?.data();
  if(operation.kind==='create'&&previous)throw Object.assign(new Error('ALREADY_EXISTS'),{code:'6'});
  if(operation.kind==='update'&&!previous)throw new Error('NOT_FOUND');
  if(operation.kind==='delete'){
   const meta=selection(ref.collectionName);
   if(meta.key==='projectOwnerLocks')return;
   if(meta.key==='projects')await client.query('UPDATE findi.account_preferences SET selected_quotation_id=NULL WHERE selected_quotation_id=$1',[ref.id]);
   if(meta.key==='masterProducts')await client.query('UPDATE findi.products SET deleted_at=now(),status=\'inactivo\',api_payload=NULL WHERE id=$1',[ref.id]);
   else await client.query(`DELETE FROM findi.${quote(meta.table)} WHERE ${quote(meta.idColumn)}=$1`,[ref.id]);
  }else{
   const values=materialize(operation.data,previous);
   const data=operation.merge||operation.kind==='update'?{...previous,...values}:values;
   await writeDocument(client,ref.collectionName,ref.id,data);
  }
  const key=mappingFor(ref.collectionName).key;
  const staticKeys=['masterProducts','masterAttributes','familyDefinitions','categories','subcategories','families','brands'];
  if(staticKeys.includes(key)||['stores','users','storeProducts','storeAgreements'].includes(key)){
   const scopes=staticKeys.includes(key)?['static','offers']:['offers'];
   await client.query('UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope=ANY($1::text[])',[scopes]);
   await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) VALUES('meta','offers','',jsonb_build_object('dirty',true,'generation',1),1,now()) ON CONFLICT(key) DO UPDATE SET payload=findi.public_cache_artifacts.payload || jsonb_build_object('dirty',true,'generation',COALESCE((findi.public_cache_artifacts.payload->>'generation')::bigint,0)+1),updated_at=now()");
   if(staticKeys.includes(key))await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) SELECT 'catalog-revision','static','',jsonb_build_object('revision',revision),1,now() FROM findi.catalog_revisions WHERE scope='static' ON CONFLICT(key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()");
  }
 }
}
class SqlDocument implements DocumentReference {
 readonly path:string;
 constructor(readonly database:PostgresDatabase,readonly collectionName:string,readonly id:string){this.path=collectionName+'/'+id;}
 async get():Promise<DocumentSnapshot>{return this.database.withClient(async client=>(await this.database.read(client,this.collectionName,this.id)).docs[0]||{id:this.id,exists:false,ref:this,data:()=>undefined});}
 async set(data:Data,options?:{merge?:boolean}){return new SqlBatch(this.database).set(this,data,options).commit();}
 async update(data:Data){return new SqlBatch(this.database).update(this,data).commit();}
 async delete(){return new SqlBatch(this.database).delete(this).commit();}
}
class SqlCollection implements CollectionReference {
 constructor(private database:PostgresDatabase,readonly name:string,private filters:Filter[]=[],private count?:number){}
 doc(id=randomUUID()):SqlDocument{return new SqlDocument(this.database,this.name,id);}
 async add(data:Data){const ref=this.doc();await ref.set(data);return ref;}
 where(field:string,op:string,value:any){return new SqlCollection(this.database,this.name,[...this.filters,[field,op,value]],this.count);}
 limit(count:number){if(!Number.isSafeInteger(count)||count<0)throw new Error('INVALID_QUERY_LIMIT');return new SqlCollection(this.database,this.name,this.filters,count);}
 get(){return this.database.withClient(client=>this.read(client));}
 read(client:SqlClient){return this.database.read(client,this.name,undefined,this.filters,this.count);}
}
class SqlBatch implements WriteBatch {
 protected operations:Operation[]=[];
 constructor(protected database:PostgresDatabase){}
 protected add(kind:Operation['kind'],ref:DocumentReference,data?:Data,merge?:boolean){if(!(ref instanceof SqlDocument)||ref.database!==this.database)throw new Error('SQL_FOREIGN_REFERENCE');this.operations.push({kind,ref,data,merge});return this;}
 set(ref:DocumentReference,data:Data,options?:{merge?:boolean}){return this.add('set',ref,data,options?.merge);}
 update(ref:DocumentReference,data:Data){return this.add('update',ref,data,true);}
 delete(ref:DocumentReference){return this.add('delete',ref);}
 async flush(client:SqlClient){for(const operation of this.operations)await this.database.apply(client,operation);}
 async commit(){return this.database.runTransaction(async tx=>{(tx as SqlTransaction).operations=this.operations;});}
}
class SqlTransaction extends SqlBatch implements Transaction {
 private writing=false;
 constructor(database:PostgresDatabase,private client:SqlClient){super(database);}
 protected override add(kind:Operation['kind'],ref:DocumentReference,data?:Data,merge?:boolean){this.writing=true;return super.add(kind,ref,data,merge);}
 create(ref:DocumentReference,data:Data){return this.add('create',ref,data);}
 get(ref:DocumentReference):Promise<DocumentSnapshot>;
 get(ref:Query):Promise<QuerySnapshot>;
 async get(ref:DocumentReference|Query):Promise<DocumentSnapshot|QuerySnapshot>{
  if(this.writing)throw new Error('TRANSACTION_READ_AFTER_WRITE');
  if(ref instanceof SqlCollection)return ref.read(this.client);
  if(!(ref instanceof SqlDocument)||ref.database!==this.database)throw new Error('SQL_FOREIGN_REFERENCE');
  return (await this.database.read(this.client,ref.collectionName,ref.id)).docs[0]||{id:ref.id,exists:false,ref,data:()=>undefined};
 }
}
