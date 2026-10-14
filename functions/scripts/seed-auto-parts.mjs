import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth,secretValue,cloudPool,projectId,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {buildAutoPartsSeed,missingAutoPartsSeedDocuments} from './lib/auto-parts-seed.mjs';
const seed=JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-repuestos-vehiculos.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');if(apply)requireApply();
const auth=await cloudAuth();const connection=await cloudPool(auth,apply?'findi_runtime':'findi_migration',await secretValue(auth,apply?'FINDI_SQL_PASSWORD':'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {
 const db=new PostgresDatabase(connection.pool);
 const readRows=async(get,collection)=>(await get(db.collection(collection))).docs.map(d=>({id:d.id,...d.data()}));
 async function plan(get){
  const brands=await readRows(get,'marcas'),models=await readRows(get,'modelosVehiculo');
  const documents=buildAutoPartsSeed(seed,brands,models,new Date().toISOString());
  for(const id of new Set(seed.offers.map(o=>o.productId))){
   const product=(await get(db.collection('productosMaestro').doc(id))).data();
   if(!product||product.estado==='inactivo'||product.categoriaId!=='cat-repuestos-automotrices')throw Error('SEED_PRODUCT_REQUIRED:'+id);
   const family=(await get(db.collection('familias').doc(product.familiaId))).data();
   if(family?.permiteVehiculos!==true)throw Error('SEED_FAMILY_REQUIRED:'+id);
  }
  const existing=new Map();
  for(const d of documents){const old=(await get(db.collection(d.collection).doc(d.id))).data();if(old)existing.set(d.collection+'/'+d.id,old);}
  return {documents,existing,create:missingAutoPartsSeedDocuments(documents,existing)};
 }
 const preview=await plan(ref=>ref.get());
 console.log(JSON.stringify({projectId,apply,batch:seed.batch,create:preview.create.length,existing:preview.existing.size,stores:seed.stores.length,products:new Set(seed.offers.map(o=>o.productId)).size,offers:seed.offers.length,vehicleApplications:seed.offers.reduce((n,o)=>n+o.vehicles.length,0)}));
 if(apply){
  const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});
  await writeFile(dir+'/auto-parts-seed-'+Date.now()+'.json',JSON.stringify({projectId,batch:seed.batch,existing:[...preview.existing],planned:preview.documents},null,2),{mode:0o600,flag:'wx'});
  await db.runTransaction(async tx=>{const current=await plan(ref=>tx.get(ref));for(const d of current.create)tx.create(db.collection(d.collection).doc(d.id),d.data);});
  console.log(JSON.stringify({seedApplied:true,created:preview.create.length,noExistingRecordsOverwritten:true}));
 }
} finally {await connection.close();}
