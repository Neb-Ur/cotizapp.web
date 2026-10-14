import {readFile,writeFile,mkdir} from 'node:fs/promises';import {homedir} from 'node:os';
import {cloudAuth,cloudPool,secretValue,projectId,requireApply} from './lib/sql-cloud.mjs';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {planInitialVehicleCatalog} from './lib/initial-vehicle-catalog.mjs';
import {masterVehicleVariants,VARIANT_BATCH} from './lib/master-vehicle-variants.mjs';
const apply=process.argv.includes('--apply');if(apply)requireApply();
const auth=await cloudAuth();const connection=await cloudPool(auth,apply?'findi_runtime':'findi_migration',await secretValue(auth,apply?'FINDI_SQL_PASSWORD':'FINDI_SQL_MIGRATION_PASSWORD'),1);
try{
 const db=new PostgresDatabase(connection.pool);const now=new Date().toISOString();
 async function plan(get){
  const read=async c=>(await get(db.collection(c))).docs.map(d=>({id:d.id,...d.data()}));
  const products=await read('productosMaestro'),offers=await read('real_productosFerreteria'),brands=await read('marcas'),models=await read('modelosVehiculo');
  const refs=planInitialVehicleCatalog({brands:[{name:'Mahindra',models:['KUV100']}]},brands,models,now);
  if(refs.updates.length)throw Error('VARIANT_BRAND_REQUIRES_REVIEW');
  const mergedBrands=[...brands,...refs.creates.filter(d=>d.collection==='marcas').map(d=>({id:d.id,...d.data}))];
  const mergedModels=[...models,...refs.creates.filter(d=>d.collection==='modelosVehiculo').map(d=>({id:d.id,...d.data}))];
  const brand=mergedBrands.find(b=>b.nombre==='Mahindra'),model=mergedModels.find(m=>m.marcaId===brand.id&&m.nombre==='KUV100');
  const extras=[[2016,2019],[2020,2023]].map(([anioDesde,anioHasta])=>({marcaId:brand.id,modeloId:model.id,marcaNombre:brand.nombre,modeloNombre:model.nombre,anioDesde,anioHasta}));
  const sources=offers.filter(o=>o.lotePrueba==='trovio-auto-seed-2026-10-13');if(sources.length!==8)throw Error('VARIANT_SOURCE_OFFERS_REQUIRED');
  const variants=masterVehicleVariants(products,sources,extras,now);
  const familyRef=db.collection('familias').doc('fam-repuestos-radiadores');const family=(await get(familyRef)).data();
  if(family && (family.nombre!=='Radiadores'||family.permiteVehiculos!==true||family.subcategoriaId!=='sub-repuestos-motor-y-electricidad'))throw Error('VARIANT_FAMILY_CONFLICT');
  const documents=[...refs.creates,...(!family?[{collection:'familias',id:familyRef.id,data:{nombre:'Radiadores',subcategoriaId:'sub-repuestos-motor-y-electricidad',permiteVehiculos:true}}]:[]),...variants.masters,...variants.offers];
  const create=[];for(const d of documents){const old=(await get(db.collection(d.collection).doc(d.id))).data();if(!old)create.push(d);else if(['productosMaestro','real_productosFerreteria'].includes(d.collection)&&old.lotePrueba!==VARIANT_BATCH)throw Error('VARIANT_ID_CONFLICT');}
  const sourceIds=new Set(sources.map(o=>o.id));const oldProducts=products.filter(p=>sources.some(o=>o.productoMaestroId===p.id));
  if(offers.some(o=>oldProducts.some(p=>p.id===o.productoMaestroId)&&!sourceIds.has(o.id)))throw Error('VARIANT_SOURCE_HAS_OTHER_OFFERS');
  return {documents,create,sources,oldProducts,variants};
 }
 const preview=await plan(ref=>ref.get());
 console.log(JSON.stringify({projectId,apply,create:preview.create.length,masters:preview.variants.masters.length,offers:preview.variants.offers.length,archiveMasters:preview.oldProducts.filter(p=>p.estado!=='inactivo').length,archiveOffers:preview.sources.filter(o=>o.activo!==false||o.publicado!==false).length}));
 if(apply){
  const dir=homedir()+'/.local/share/cotizapp/backups';await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+'/master-variants-'+Date.now()+'.json',JSON.stringify({projectId,previousMasters:preview.oldProducts,previousOffers:preview.sources,planned:preview.documents}),{mode:0o600,flag:'wx'});
  await db.runTransaction(async tx=>{const current=await plan(ref=>tx.get(ref));for(const d of current.create)tx.create(db.collection(d.collection).doc(d.id),d.data);for(const p of current.oldProducts)if(p.estado!=='inactivo')tx.update(db.collection('productosMaestro').doc(p.id),{estado:'inactivo',actualizadoEn:now});for(const o of current.sources)if(o.activo!==false||o.publicado!==false)tx.update(db.collection('real_productosFerreteria').doc(o.id),{activo:false,publicado:false,actualizadoEn:now});});
  console.log(JSON.stringify({variantSeedApplied:true,originalIdsPreserved:true,batch:VARIANT_BATCH}));
 }
}finally{await connection.close();}
