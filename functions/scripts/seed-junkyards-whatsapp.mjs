import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth,cloudPool,secretValue,projectId,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {writeDocument} from '../lib/database/codec.js';
import {existingExpansionDocuments} from './lib/catalog-expansion-200.mjs';
import {buildJunkyardDocuments,planJunkyardWrites} from './lib/junkyard-whatsapp-seed.mjs';
const seed=JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-desarmadurias-whatsapp.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');if(apply)requireApply();
const auth=await cloudAuth(),connection=await cloudPool(auth,apply?'findi_runtime':'findi_migration',await secretValue(auth,apply?'FINDI_SQL_PASSWORD':'FINDI_SQL_MIGRATION_PASSWORD'),1);
try{
 const db=new PostgresDatabase(connection.pool),now=new Date().toISOString();
 async function plan(client){
  const ids=[...new Set(seed.offers.map(o=>o.productId))];
  const products=(await client.query('SELECT id,api_payload FROM findi.products WHERE id=ANY($1::text[]) AND deleted_at IS NULL',[ids])).rows.map(r=>({id:r.id,...r.api_payload}));
  const documents=buildJunkyardDocuments(seed,products,now);
  const existing=await existingExpansionDocuments(client,[...documents,...seed.existingContactStoreIds.map(id=>({collection:'real_ferreterias',id}))]);
  return {documents,existing,...planJunkyardWrites(seed,documents,existing,now)};
 }
 const preview=await db.withClient(plan);
 console.log(JSON.stringify({projectId,apply,newStores:4,offers:80,create:preview.create.length,contactUpdates:preview.contacts.length}));
 if(apply){
  const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});
  await writeFile(dir+'/junkyard-whatsapp-'+Date.now()+'.json',JSON.stringify({projectId,previous:[...preview.existing],planned:preview.documents,contacts:preview.contacts}),{mode:0o600,flag:'wx'});
  let result;
  for(let attempt=0;attempt<5;attempt++){
   try{result=await db.withClient(async client=>{
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    try{
     const current=await plan(client);
     for(const d of current.create)await writeDocument(client,d.collection,d.id,d.data);
     for(const d of current.contacts)await writeDocument(client,'real_ferreterias',d.id,d.data);
     if(current.create.length||current.contacts.length){
      await client.query("UPDATE findi.catalog_revisions SET revision=revision+1,changed_at=now() WHERE scope='offers'");
      await client.query("INSERT INTO findi.public_cache_artifacts(key,scope,version,payload,schema_version,updated_at) VALUES('meta','offers','',jsonb_build_object('dirty',true,'generation',1),1,now()) ON CONFLICT(key) DO UPDATE SET payload=findi.public_cache_artifacts.payload || jsonb_build_object('dirty',true,'generation',COALESCE((findi.public_cache_artifacts.payload->>'generation')::bigint,0)+1),updated_at=now()");
     }
     await client.query('COMMIT');return{created:current.create.length,contactsUpdated:current.contacts.length};
    }catch(error){await client.query('ROLLBACK');throw error;}
   });break;}catch(error){if(!['40001','40P01'].includes(error.code)||attempt===4)throw error;}
  }
  console.log(JSON.stringify({applied:true,...result,noNewAuthenticationAccounts:true}));
 }
}finally{await connection.close();}
