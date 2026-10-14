import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {cloudAuth,secretValue,cloudPool,projectId,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {planInitialVehicleCatalog} from './lib/initial-vehicle-catalog.mjs';
const catalog=JSON.parse(await readFile(new URL('../../docs/catalogo/catalogo-vehiculos-inicial.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');if(apply)requireApply();
const auth=await cloudAuth();const connection=await cloudPool(auth,apply?'findi_runtime':'findi_migration',await secretValue(auth,apply?'FINDI_SQL_PASSWORD':'FINDI_SQL_MIGRATION_PASSWORD'),1);
try {
 const db=new PostgresDatabase(connection.pool);
 const read=async get=>{const [brands,models]=await Promise.all([get(db.collection('marcas')),get(db.collection('modelosVehiculo'))]);return [brands.docs.map(d=>({id:d.id,...d.data()})),models.docs.map(d=>({id:d.id,...d.data()}))];};
 const existing=await read(ref=>ref.get());
 const plan=planInitialVehicleCatalog(catalog,...existing,new Date().toISOString());
 console.log(JSON.stringify({projectId,apply,create:plan.creates.length,update:plan.updates.length,brands:catalog.brands.length,models:plan.references.length}));
 if(apply) {
  const directory=homedir()+'/.local/share/cotizapp/backups';await mkdir(directory,{recursive:true,mode:0o700});
  await writeFile(directory+'/vehicle-references-'+Date.now()+'.json',JSON.stringify({projectId,existing,plan},null,2),{mode:0o600,flag:'wx'});
  await db.runTransaction(async tx=>{
   const latest=await read(ref=>tx.get(ref));
   const writes=planInitialVehicleCatalog(catalog,...latest,new Date().toISOString());
   for(const item of [...writes.creates,...writes.updates]) {
    const ref=db.collection(item.collection).doc(item.id);
    if(writes.creates.includes(item))tx.create(ref,item.data);else tx.update(ref,item.data);
   }
  });
  console.log(JSON.stringify({referencesImported:true,offerAssociationsCreated:0}));
 }
} finally {await connection.close();}
