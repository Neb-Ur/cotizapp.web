import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {FieldValue} from 'firebase-admin/firestore';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {replicateDocument} from '../lib/database/replication.js';
import {useSqlDatabase} from '../lib/database/config.js';
async function fixture(t,ready=true,includeCondition=true){
 const pg=new PGlite();
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','011-quotation-verification.sql','012-advisory-quotation-period.sql','013-store-reviews.sql','015-offer-condition.sql','016-store-business-type.sql','017-vehicle-reference-catalog.sql','018-offer-vehicle-applications.sql','019-product-vehicle-applications.sql','020-donor-vehicles.sql','021-donor-trigger-search-path.sql'].filter(file=>includeCondition||file!=='015-offer-condition.sql'))await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
 const pool={connect:async()=>({query:pg.query.bind(pg),release(){}})};
 const db=new PostgresDatabase(pool,ready);
 t.after(()=>pg.close());
 await pg.query("INSERT INTO findi.database_migration_state(id,status,source_project) VALUES('firestore-to-sql','verified','test')");
 return {db,pg,pool};
}
async function catalog(db){
 await db.collection('usuarios').doc('master').set({rol:'maestro',nombre:'Maestro',correo:'master@example.test',estadoCuenta:'activo'});
 await db.collection('usuarios').doc('store-owner').set({rol:'ferreteria',nombre:'Local',correo:'local@example.test',estadoCuenta:'activo'});
 await db.collection('categorias').doc('cat').set({nombre:'Maderas',icono:'wood'});
 await db.collection('subcategorias').doc('sub').set({nombre:'Tableros',categoriaId:'cat'});
 await db.collection('familias').doc('family').set({nombre:'MDF',subcategoriaId:'sub'});
 await db.collection('marcas').doc('brand').set({nombre:'Marca de prueba',nombreNormalizado:'marca de prueba'});
 await db.collection('productosMaestro').doc('product').set({nombre:'MDF negro 18 mm',familiaId:'family',categoriaId:'cat',subcategoriaId:'sub',marcaId:'brand',marca:'Marca de prueba',estado:'activo',galeriaJson:[],caracteristicasDestacadas:['18 mm']});
 await db.collection('real_ferreterias').doc('store').set({usuarioDuenoId:'store-owner',nombreComercial:'Local de prueba',estado:'activo'});
}
test('200-product expansion writes normalized children, invalidates once and can resume without overwriting prior records', async t => {
 const {db,pg}=await fixture(t);await catalog(db);
 const before=(await db.collection('productosMaestro').doc('product').get()).data();
 const {expansionFixture}=await import('./helpers/catalog-expansion.fixture.mjs');
 const {planCatalogExpansion,applyExpansionChunk}=await import('../scripts/lib/catalog-expansion-200.mjs');
 const now=new Date().toISOString(),{seed,state,categories}=await expansionFixture(now);
 const put=async(c,d)=>{const {id,...data}=d;await db.collection(c).doc(id).set(data);};
 for(const c of categories)await put('categorias',c);
 for(const c of state.subcategories)await put('subcategorias',c);
 for(const c of state.families)await put('familias',c);
 for(const c of state.brands)await put('marcas',c);
 for(const c of state.models)await put('modelosVehiculo',c);
 for(const c of state.users)await put('usuarios',c);
 for(const c of state.stores)await put('real_ferreterias',c);
 const plan=planCatalogExpansion(seed,state,now);
 await applyExpansionChunk(db,plan.prerequisites,plan.updates);
 const revisions=async()=>(await pg.query('SELECT scope,revision FROM findi.catalog_revisions ORDER BY scope')).rows;
 const initialRevisions=await revisions();
 const docs=[...plan.products,...plan.offers];
 assert.equal((await applyExpansionChunk(db,docs)).created,600);
 const afterRevisions=await revisions();
 assert.ok(afterRevisions.every((r,i)=>Number(r.revision)===Number(initialRevisions[i].revision)+1));
 assert.deepEqual(await applyExpansionChunk(db,docs),{created:0,updated:0});
 assert.deepEqual(await revisions(),afterRevisions);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_vehicle_applications')).rows[0].n,100);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,0);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_media')).rows[0].n,244);
 const mahindra=(await db.collection('marcas').doc(state.brands.find(b=>b.nombre==='Mahindra').id).get()).data();
 assert.deepEqual(new Set(mahindra.usos),new Set(['vehiculo','fabricante']));
 const edited=plan.offers[0];await db.collection(edited.collection).doc(edited.id).update({precio:77777});
 assert.equal((await applyExpansionChunk(db,docs)).created,0);
 assert.equal((await db.collection(edited.collection).doc(edited.id).get()).data().precio,77777);
 assert.deepEqual((await db.collection('productosMaestro').doc('product').get()).data(),before);
 const reference=(await pg.query("SELECT payload FROM findi.public_cache_artifacts WHERE key='meta'")).rows[0].payload;assert.equal(reference.dirty,true);
 // A later chunk must still refuse a store that has ceased to be synthetic.
 const extra={...plan.offers[1],id:'expansion-blocked-offer'};
 await db.collection('real_ferreterias').doc(extra.data.ferreteriaId).update({esPrueba:false});
 await assert.rejects(applyExpansionChunk(db,[extra]),/TEST_STORE_CHANGED/);
 assert.equal((await db.collection(extra.collection).doc(extra.id).get()).exists,false);
 const first={...plan.products[0],id:'expansion-rolled-back-product',data:{...plan.products[0].data,detalleVariante:'rollback-case'}};
 const invalid={...plan.products[1],id:'expansion-invalid-product',data:{...plan.products[1].data,familiaId:'missing-family'}};
 await assert.rejects(applyExpansionChunk(db,[first,invalid]));
 assert.equal((await db.collection(first.collection).doc(first.id).get()).exists,false);
});
test('expanded KUV catalog persists galleries and master years, compares junkyards and leaves prior data intact', async t => {
 const {db,pg}=await fixture(t);await catalog(db);
 const before=(await db.collection('productosMaestro').doc('product').get()).data();
 const {buildKuv100CatalogSeed,missingKuv100SeedDocuments}=await import('../scripts/lib/kuv100-catalog-seed.mjs');
 const {planInitialVehicleCatalog}=await import('../scripts/lib/initial-vehicle-catalog.mjs');
 const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');
 const {paginateProductSearch}=await import('../lib/domain/product-search.js');
 const seed=JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-kuv100-ampliada.json',import.meta.url),'utf8'));
 const now=new Date().toISOString();
 const refs=planInitialVehicleCatalog({brands:[{name:'Mahindra',models:['KUV100']}]},[],[],now);
 for(const d of refs.creates)await db.collection(d.collection).doc(d.id).set(d.data);
 await db.collection('categorias').doc('cat-repuestos-automotrices').set({nombre:'Repuestos automotrices',icono:'car'});
 for(const id of ['sub-repuestos-motor-y-electricidad','sub-repuestos-frenos-y-suspension'])await db.collection('subcategorias').doc(id).set({nombre:id,categoriaId:'cat-repuestos-automotrices'});
 const read=async c=>(await db.collection(c).get()).docs.map(d=>({id:d.id,...d.data()}));
 const docs=buildKuv100CatalogSeed(seed,await read('marcas'),await read('modelosVehiculo'),now);
 await db.runTransaction(async tx=>{for(const d of docs)tx.create(db.collection(d.collection).doc(d.id),d.data);});
 const existing=new Map();for(const d of docs)existing.set(d.collection+'/'+d.id,(await db.collection(d.collection).doc(d.id).get()).data());
 assert.deepEqual(missingKuv100SeedDocuments(docs,existing),[]);
 assert.deepEqual((await db.collection('productosMaestro').doc('product').get()).data(),before);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_vehicle_applications')).rows[0].n,44);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,0);
 const masters=(await read('productosMaestro')).filter(p=>p.lotePrueba===seed.batch);
 const sensor=masters.find(p=>p.referenciaProveedor==='M200298');assert.equal(sensor.galeriaJson.length,6);
 const publications=await read('real_productosFerreteria');
 const source=[publications,await read('productosMaestro'),await read('real_ferreterias'),await read('usuarios'),await read('categorias'),await read('subcategorias'),await read('familias')];
 const previous=process.env.PILOT_STORES_ENABLED;process.env.PILOT_STORES_ENABLED='true';
 let rows;try{rows=await buildSearchRows(source);}finally{if(previous===undefined)delete process.env.PILOT_STORES_ENABLED;else process.env.PILOT_STORES_ENABLED=previous;}
 assert.equal(rows.length,110);
 const snapshot={version:'kuv',updatedAt:now,products:masters,searchRows:rows,taxonomy:{categories:source[4],subcategories:source[5],families:source[6]}};
 const app=sensor.compatibilidadVehiculos[0];
 const options={vehicleBrandId:app.marcaId,vehicleModelId:app.modeloId,vehicleYear:2021,page:1,size:100,sort:'price-asc'};
 const late=paginateProductSearch(snapshot,options);
 const result=late.items.find(p=>p.productoMaestroId===sensor.id);
 assert.ok(result.storeCount>=2);assert.ok(result.maxPrice>result.minPrice);
 assert.equal(paginateProductSearch(snapshot,{...options,vehicleYear:2024}).total,0);
 const early=paginateProductSearch(snapshot,{...options,vehicleYear:2016});
 const earlyLamp=masters.find(p=>p.codigoFabricante==='1701AAA07781N');
 assert.ok(early.items.some(p=>p.productoMaestroId===earlyLamp.id));
 assert.ok(!late.items.some(p=>p.productoMaestroId===earlyLamp.id));
 assert.ok(paginateProductSearch(snapshot,{...options,storeId:seed.stores[2].id}).total<late.total);
});
test('automotive seed persists normalized year ranges and filters the same product by model/year/local',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const before=(await db.collection('productosMaestro').doc('product').get()).data();
 const {buildBaseAutoPartDocuments}=await import('../scripts/lib/base-auto-parts.mjs');
 const {planInitialVehicleCatalog}=await import('../scripts/lib/initial-vehicle-catalog.mjs');
 const {buildAutoPartsSeed,missingAutoPartsSeedDocuments}=await import('../scripts/lib/auto-parts-seed.mjs');
 const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');
 const {paginateProductSearch}=await import('../lib/domain/product-search.js');
 const read=async collection=>(await db.collection(collection).get()).docs.map(d=>({id:d.id,...d.data()}));
 const load=async name=>JSON.parse(await readFile(new URL('../../docs/catalogo/'+name,import.meta.url),'utf8'));
 const now=new Date().toISOString();
 const refs=planInitialVehicleCatalog(await load('catalogo-vehiculos-inicial.json'),await read('marcas'),[],now);
 for(const d of [...refs.creates,...buildBaseAutoPartDocuments(await load('catalogo-repuestos-base.json'),now)])await db.collection(d.collection).doc(d.id).set(d.data);
 const documents=buildAutoPartsSeed(await load('semilla-repuestos-vehiculos.json'),await read('marcas'),await read('modelosVehiculo'),now);
 await db.runTransaction(async tx=>{for(const d of documents)tx.create(db.collection(d.collection).doc(d.id),d.data);});
 const existing=new Map();for(const d of documents)existing.set(d.collection+'/'+d.id,(await db.collection(d.collection).doc(d.id).get()).data());
 assert.deepEqual(missingAutoPartsSeedDocuments(documents,existing),[]);
 assert.deepEqual((await db.collection('productosMaestro').doc('product').get()).data(),before);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,24);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offers')).rows[0].n,8);
 const source=await Promise.all(['real_productosFerreteria','productosMaestro','real_ferreterias','usuarios','categorias','subcategorias','familias'].map(read));
 const previous=process.env.PILOT_STORES_ENABLED;process.env.PILOT_STORES_ENABLED='true';
 let searchRows;try{searchRows=await buildSearchRows(source);}finally{if(previous===undefined)delete process.env.PILOT_STORES_ENABLED;else process.env.PILOT_STORES_ENABLED=previous;}
 const model=(await read('modelosVehiculo')).find(m=>m.nombre==='Corolla');
 const snapshot={version:'seed',updatedAt:now,products:source[1].map(p=>({...p,compatibilidadVehiculos:searchRows.filter(o=>o.productoMaestroId===p.id&&o.storeId==='seed-auto-store-repuestos').flatMap(o=>o.vehicleApplications).filter(a=>a.modeloId===model.id)})),searchRows,taxonomy:{categories:source[4],subcategories:source[5],families:source[6]}};
 const options={vehicleBrandId:model.marcaId,vehicleModelId:model.id,vehicleYear:2010,page:1,size:20,sort:'price-asc'};
 const early=paginateProductSearch(snapshot,options);assert.equal(early.total,3);
 const alternator=early.items.find(p=>p.productoMaestroId==='base-repuesto-alternador-automotriz');assert.equal(alternator.storeCount,2);assert.equal(alternator.minPrice,55000);assert.equal(alternator.maxPrice,125000);
 const late=paginateProductSearch(snapshot,{...options,vehicleYear:2018}).items.find(p=>p.productoMaestroId===alternator.productoMaestroId);
 assert.equal(late.storeCount,1);assert.equal(late.minPrice,125000);
 assert.equal(paginateProductSearch(snapshot,{...options,vehicleYear:2013}).total,0);
 assert.equal(paginateProductSearch(snapshot,{...options,vehicleYear:2018,storeId:'seed-auto-store-desarmaduria'}).total,0);
});
test('SQL flag is false by default and rejects ambiguous values',()=>{
 const before=process.env.USE_SQL_DATABASE;try{delete process.env.USE_SQL_DATABASE;assert.equal(useSqlDatabase(),false);process.env.USE_SQL_DATABASE='true';assert.equal(useSqlDatabase(),true);process.env.USE_SQL_DATABASE='1';assert.throws(useSqlDatabase);}finally{if(before===undefined)delete process.env.USE_SQL_DATABASE;else process.env.USE_SQL_DATABASE=before;}
});
test('SQL preserves DTOs and creates real normalized relationships',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const snapshot=await db.collection('productosMaestro').doc('product').get();assert.equal(snapshot.data().marcaId,'brand');
 assert.equal((await pg.query('SELECT brand_id,family_id FROM findi.products')).rows[0].brand_id,'brand');
 assert.equal((await pg.query('SELECT text FROM findi.product_features')).rows[0].text,'18 mm');
 assert.equal((await db.collection('productosMaestro').where('familiaId','==','family').get()).size,1);
 await assert.rejects(db.collection('productosMaestro').doc('invalid').set({nombre:'Otro',familiaId:'missing'}));
 assert.equal((await db.collection('productosMaestro').doc('invalid').get()).exists,false);
});
test('SQL keeps ordered duplicate quote lines, rolls back a failed batch and enforces quote limit',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const input={ownerId:'master',name:'Obra',items:[{productName:'MDF negro 18 mm',quantity:1,productoMaestroId:'product'},{productName:'MDF negro 18 mm',quantity:2,productoMaestroId:'product'}],createdAt:'2026-10-08T12:00:00Z'};
 await db.collection('real_proyectos').doc('first').set(input);await db.collection('real_proyectos').doc('second').set({...input,name:'Obra 2'});
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_items')).rows[0].n,4);
 assert.deepEqual((await db.collection('real_proyectos').doc('first').get()).data(),input);
 await assert.rejects(db.collection('real_proyectos').doc('third').set(input),/COTIZACION_LIMIT_REACHED/);
 const batch=db.batch();batch.update(db.collection('usuarios').doc('master'),{nombre:'Cambio'});batch.set(db.collection('real_productosFerreteria').doc('invalid'),{ferreteriaId:'store',productoMaestroId:'product',precio:-1,stock:2});await assert.rejects(batch.commit());
 assert.equal((await db.collection('usuarios').doc('master').get()).data().nombre,'Maestro');
});
test('SQL translates atomic increments and invalidates cache when product changes',async t=>{
 const {db}=await fixture(t);await catalog(db);
 await db.collection('real_storeMetrics').doc('store').set({views:FieldValue.increment(1),updatedAt:'2026-10-08T12:00:00Z'},{merge:true});
 await db.collection('real_storeMetrics').doc('store').set({views:FieldValue.increment(2)},{merge:true});assert.equal((await db.collection('real_storeMetrics').doc('store').get()).data().views,3);
 const before=(await db.collection('real_cachePublico').doc('catalog-revision').get()).data().revision;
 await db.collection('productosMaestro').doc('product').update({nombre:'MDF actualizado'});
 assert.ok((await db.collection('real_cachePublico').doc('catalog-revision').get()).data().revision>before);
 assert.equal((await db.collection('real_cachePublico').doc('meta').get()).data().dirty,true);
});
test('SQL replication ignores duplicate and older events',async t=>{
 const {db,pool}=await fixture(t);await catalog(db);
 const input=(await db.collection('productosMaestro').doc('product').get()).data();
 assert.equal(await replicateDocument(pool,'productosMaestro','product',{...input,nombre:'Nuevo'},'200'),true);
 assert.equal(await replicateDocument(pool,'productosMaestro','product',{...input,nombre:'Antiguo'},'100'),false);
 assert.equal(await replicateDocument(pool,'productosMaestro','product',input,'200'),false);
 assert.equal((await db.collection('productosMaestro').doc('product').get()).data().nombre,'Nuevo');
});
test('SQL access remains blocked until migration is verified',async t=>{
 const {db,pg}=await fixture(t);await pg.query("UPDATE findi.database_migration_state SET status='copying'");await assert.rejects(db.collection('usuarios').get(),/SQL_MIGRATION_NOT_VERIFIED/);
});
test('SQL stores real typed attributes and rejects invalid selections',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('definicionesAtributoFamilia').doc('color').set({familiaId:'family',codigo:'color',etiqueta:'Color',tipoDato:'seleccion',opcionesJson:['Negro','Rojo'],esFiltrable:true});
 await db.collection('atributosProductoMaestro').doc('attribute').set({productoMaestroId:'product',definicionAtributoId:'color',valorOpcion:'Negro',valorTexto:null,valorNumero:null,valorBooleano:null});
 assert.equal((await pg.query('SELECT option_value FROM findi.product_attributes')).rows[0].option_value,'Negro');
 await assert.rejects(db.collection('atributosProductoMaestro').doc('attribute').update({valorOpcion:'Azul'}));
 assert.equal((await db.collection('atributosProductoMaestro').doc('attribute').get()).data().valorOpcion,'Negro');
});
test('SQL preserves legal onboarding and exposes only eligible public prices',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const {CURRENT_STORE_AGREEMENT_VERSION,STORE_AGREEMENT_PROVIDER}=await import('../lib/lib/legal.js');
 const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
 const at='2026-10-08T12:00:00Z',version=CURRENT_STORE_AGREEMENT_VERSION,documentHash=storeAgreementDocumentHash();
 const batch=db.batch();
 batch.set(db.collection('real_contratosFerreteria').doc('agreement'),{ferreteriaId:'store',usuarioFirmanteId:'store-owner',version,documentHash,estado:'vigente',proveedor:STORE_AGREEMENT_PROVIDER,ferreteria:{nombreComercial:'Local'},firmante:{nombre:'Local'},declaraciones:{aceptacionIntegra:true},evidencia:{source:'store_onboarding'},aceptadoEn:at});
 batch.update(db.collection('real_ferreterias').doc('store'),{contratoEstado:'vigente',contratoVersion:version,contratoDocumentHash:documentHash});
 await batch.commit();
 await db.collection('real_productosFerreteria').doc('offer').set({ferreteriaId:'store',productoMaestroId:'product',precio:1500,stock:0,incluyeIva:true,activo:true,publicado:true});
 const result=(await pg.query('SELECT price,comparison_eligible FROM findi.public_offers')).rows;
 assert.equal(result.length,1);assert.equal(Number(result[0].price),1500);assert.equal(result[0].comparison_eligible,false);
 await assert.rejects(db.collection('real_productosFerreteria').doc('duplicate').set({ferreteriaId:'store',productoMaestroId:'product',precio:1600,stock:1}));
 await db.collection('real_ferreterias').doc('store').update({contratoEstado:'suspendido'});
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.public_offers')).rows[0].n,0);
});
test('SQL deletion retains historical quotation references while hiding removed products',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('real_proyectos').doc('quote').set({ownerId:'master',name:'Obra',items:[{productName:'MDF negro',quantity:1,productoMaestroId:'product'}]});
 await db.collection('productosMaestro').doc('product').delete();assert.equal((await db.collection('productosMaestro').doc('product').get()).exists,false);
 assert.equal((await pg.query('SELECT product_reference FROM findi.quotation_items')).rows[0].product_reference,'product');
 assert.equal((await db.collection('real_proyectos').doc('quote').get()).data().items[0].productoMaestroId,'product');
});
test('SQL replication stops after SQL becomes the authority',async t=>{
 const {db,pg,pool}=await fixture(t);await catalog(db);
 const input=(await db.collection('productosMaestro').doc('product').get()).data();
 await pg.query("UPDATE findi.database_migration_state SET status='active'");
 assert.equal(await replicateDocument(pool,'productosMaestro','product',{...input,nombre:'Cambio viejo de Firestore'},'999'),false);
 assert.equal((await db.collection('productosMaestro').doc('product').get()).data().nombre,input.nombre);
});
test('final cutover reconciliation includes the last Firestore changes atomically',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const {mappingByCollection}=await import('../lib/database/codec.js');
 const {reconcileFinalSource}=await import('../lib/database/cutover.js');
 const source=new Map();
 for(const [collection,mapping]of mappingByCollection){if(['publicCache','projectOwnerLocks'].includes(mapping.key))continue;const snapshot=await db.collection(collection).get();source.set(collection,snapshot.docs.map(doc=>({id:doc.id,data:doc.data()})));}
 source.get('productosMaestro')[0].data.nombre='Último cambio antes de activar';
 source.get('marcas').push({id:'new-brand',data:{nombre:'Nueva marca',nombreNormalizado:'nueva marca'}});
 source.get('productosMaestro').push({id:'new-product',data:{nombre:'Producto nuevo',familiaId:'family',marcaId:'new-brand'}});
 const firestore={collection:name=>({get:async()=>({docs:(source.get(name)||[]).map(doc=>({id:doc.id,data:()=>doc.data}))})})};
 await pg.exec('BEGIN');await reconcileFinalSource(pg,firestore,db);await pg.exec('COMMIT');
 assert.equal((await db.collection('productosMaestro').doc('product').get()).data().nombre,'Último cambio antes de activar');
 assert.equal((await db.collection('productosMaestro').doc('new-product').get()).data().marcaId,'new-brand');
 // A constraint failure rolls back earlier changes in the reconciliation.
 source.get('productosMaestro')[0].data.nombre='No debe guardarse';
 source.get('real_solicitudesContacto').push({id:'invalid',data:{type:'otro',privacyConsent:{granted:true}}});
 await pg.exec('BEGIN');await assert.rejects(reconcileFinalSource(pg,firestore,db));await pg.exec('ROLLBACK');
 assert.equal((await db.collection('productosMaestro').doc('product').get()).data().nombre,'Último cambio antes de activar');
});
test('SQL preserves Storage and external fallback assets without duplicate images or invented permissions',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const storage='https://storage.example/product.webp',external='https://maker.example/product.webp',thumbnail='https://storage.example/thumbnail.webp';
 await db.collection('productosMaestro').doc('product').update({imagenPrincipalUrl:storage,imagenStorageUrl:storage,imagenStoragePath:'productos/product/main.webp',imagenMiniaturaUrl:thumbnail,imagenMiniaturaPath:'productos/product/thumbnail.webp',imagenExternaUrl:external,galeriaJson:[storage],origenImagen:'external_url'});
 const assets=(await pg.query('SELECT a.url,a.storage_path,a.rights_id,m.is_primary FROM findi.media_assets a JOIN findi.product_media m ON m.asset_id=a.id WHERE m.product_id=$1 ORDER BY m.position',['product'])).rows;
 assert.equal(assets.length,3);assert.equal(assets[2].url,thumbnail);assert.equal(assets[2].storage_path,'productos/product/thumbnail.webp');assert.equal(assets[2].is_primary,false);assert.equal(assets[0].url,storage);assert.equal(assets[0].storage_path,'productos/product/main.webp');assert.equal(assets[0].is_primary,true);assert.equal(assets[1].url,external);assert.equal(assets[1].is_primary,false);assert.ok(assets.every(a=>a.rights_id===null));
 await db.collection('productosMaestro').doc('product').update({imagenPrincipalUrl:'',imagenStorageUrl:'',imagenMiniaturaUrl:'',imagenExternaUrl:'',galeriaJson:[]});
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_media')).rows[0].n,0);
});
test('active SQL connections validate readiness once, while unactivated migrations remain checked',async t=>{
 const {pg}=await fixture(t);let validations=0;
 const pool={connect:async()=>({query:(sql,values)=>{if(sql.includes('SELECT status FROM findi.database_migration_state'))validations++;return pg.query(sql,values);},release(){}})};
 const db=new PostgresDatabase(pool,true);
 await pg.query("UPDATE findi.database_migration_state SET status='active'");
 await db.collection('categorias').get();await db.collection('categorias').get();assert.equal(validations,1);
 await pg.query("UPDATE findi.database_migration_state SET status='verified'");const checking=new PostgresDatabase(pool,true);
 await checking.collection('categorias').get();await checking.collection('categorias').get();assert.equal(validations,3);
});

test('a real external fallback never inherits the generated image source or its rights reference',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const main='https://images.example/generated.webp',fallback='https://maker.example/real.jpg';
 await db.collection('productosMaestro').doc('product').update({imagenPrincipalUrl:main,imagenStorageUrl:main,imagenStoragePath:'p/generated.webp',imagenExternaUrl:fallback,origenImagen:'ai_generated',referenciaAutorizacion:'Generated image reference',proveedorImagen:'OpenAI'});
 const assets=(await pg.query('SELECT a.url,a.origin,a.rights_id FROM findi.media_assets a JOIN findi.product_media m ON m.asset_id=a.id WHERE m.product_id=$1',['product'])).rows;
 assert.equal(assets.find(a=>a.url===main).origin,'storage');assert.ok(assets.find(a=>a.url===main).rights_id);
 assert.equal(assets.find(a=>a.url===fallback).origin,'external_url');assert.equal(assets.find(a=>a.url===fallback).rights_id,null);
});

test('verification records are persisted by code and cannot be overwritten',async t=>{
 const {db}=await fixture(t);const ref=db.collection('real_cotizacionesVerificables').doc('FND-AAAA-BBBB-CCCC-DDDD');
 const snapshot={code:ref.id,quotationReference:'quote',issuedAt:'2026-10-09T12:00:00Z',recommendedUntil:'2026-09-01T12:00:00Z',lines:[{storeId:'store',productName:'Cemento',unitPrice:1000,quantity:2,subtotal:2000}]};
 await ref.set(snapshot);assert.deepEqual((await ref.get()).data(),snapshot);
 await assert.rejects(ref.update({lines:[]}));assert.deepEqual((await ref.get()).data(),snapshot);
});


test('store reviews persist normalized links, enforce one per maestro and cascade on account deletion', async t => {
 const {db,pg}=await fixture(t);await catalog(db);
 const review={storeId:'store',userId:'master',authorName:'Maestro',rating:4,comment:'Buena atención',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await db.collection('real_resenasFerreteria').doc('r').set(review);
 assert.equal((await db.collection('real_resenasFerreteria').where('storeId','==','store').get()).size,1);
 assert.equal((await pg.query('SELECT rating FROM findi.store_reviews')).rows[0].rating,4);
 await assert.rejects(db.collection('real_resenasFerreteria').doc('duplicate').set(review));
 await assert.rejects(db.collection('real_resenasFerreteria').doc('bad').set({...review,userId:'store-owner',rating:6}));
 await db.collection('usuarios').doc('master').delete();
 assert.equal((await db.collection('real_resenasFerreteria').get()).size,0);
});

test('analytics claims block duplicate intervals, allow subsequent cuts and migrate the old daily lock',async t=>{
 const {claimStoreAnalyticsPeriod}=await import('../lib/services/store-daily-analytics.service.js');
 const {db}=await fixture(t);
 const ref=db.collection('real_analyticsJobs').doc('store-daily-analytics');
 await ref.set({attemptDate:'2026-10-11',startedAt:'2026-10-11T05:00:00Z',status:'complete'});
 assert.equal(await claimStoreAnalyticsPeriod(db,new Date('2026-10-11T05:00:00Z')),true);
 assert.equal(await claimStoreAnalyticsPeriod(db,new Date('2026-10-11T06:59:59Z')),false);
 await ref.update({status:'failed'});
 assert.equal(await claimStoreAnalyticsPeriod(db,new Date('2026-10-11T06:59:59Z')),false);
 assert.equal(await claimStoreAnalyticsPeriod(db,new Date('2026-10-11T07:00:00Z')),true);
 assert.equal((await ref.get()).data().attemptPeriod,'2026-10-11T04');
 assert.equal(await claimStoreAnalyticsPeriod(db,new Date('2026-10-12T03:00:00Z')),true);
 assert.equal((await ref.get()).data().attemptDate,'2026-10-12');
});

 test('condition migration preserves old offers and typed/payload values stay consistent on edits',async t=>{
  const {db,pg}=await fixture(t,true,false);await catalog(db);
  const old={ferreteriaId:'store',productoMaestroId:'product',precio:1500,stock:3,activo:true,publicado:true};
  await pg.query('INSERT INTO findi.offers(id,store_id,product_id,price,stock,api_payload) VALUES($1,$2,$3,$4,$5,$6)', ['legacy-offer','store','product',1500,3,old]);
  await pg.exec(await readFile(new URL('../../sql/findi/015-offer-condition.sql',import.meta.url),'utf8'));
  let row=(await pg.query('SELECT * FROM findi.offers WHERE id=$1',['legacy-offer'])).rows[0];
  assert.equal(row.condition,'sin_especificar');assert.deepEqual(row.api_payload,{...old,condicion:'sin_especificar'});
  assert.equal(Number(row.price),1500);assert.equal(Number(row.stock),3);
  await db.collection('real_productosFerreteria').doc('legacy-offer').update({condicion:'usado'});
  row=(await pg.query('SELECT condition,api_payload FROM findi.offers WHERE id=$1',['legacy-offer'])).rows[0];
  assert.equal(row.condition,'usado');assert.equal(row.api_payload.condicion,'usado');
  await assert.rejects(db.collection('real_productosFerreteria').doc('legacy-offer').update({condicion:'activo'}),/OFFER_CONDITION_INVALID/);
  await assert.rejects(pg.query("UPDATE findi.offers SET condition='activo' WHERE id='legacy-offer'"));
 });

test('SQL stores business classification in columns and payload without changing ownership or role',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 let store=(await pg.query('SELECT business_type,api_payload FROM findi.stores WHERE id=$1',['store'])).rows[0];
 assert.equal(store.business_type,'ferreteria');assert.equal(store.api_payload.tipoNegocio,'ferreteria');
 await db.collection('real_ferreterias').doc('store').update({tipoNegocio:'desarmaduria'});
 store=(await pg.query('SELECT owner_id,business_type,api_payload FROM findi.stores WHERE id=$1',['store'])).rows[0];
 assert.equal(store.owner_id,'store-owner');assert.equal(store.business_type,'desarmaduria');assert.equal(store.api_payload.tipoNegocio,'desarmaduria');
 assert.equal((await db.collection('usuarios').doc('store-owner').get()).data().rol,'ferreteria');
 await assert.rejects(db.collection('real_ferreterias').doc('store').update({tipoNegocio:'admin'}),/BUSINESS_TYPE_INVALID/);
 await assert.rejects(pg.query("UPDATE findi.stores SET business_type='admin' WHERE id='store'"));
});

test('vehicle references enforce brand use and keep manufacturer, product model and family relationships intact',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('productosMaestro').doc('product').update({modelo:'Modelo comercial'});
 const previous=(await pg.query('SELECT model_id,brand_id,family_id FROM findi.products WHERE id=$1',['product'])).rows[0];
 const model={marcaId:'brand',nombre:'Modelo de vehículo',nombreNormalizado:'modelo de vehiculo',activo:true};
 await assert.rejects(db.collection('modelosVehiculo').doc('v').set(model));
 await db.collection('marcas').doc('brand').update({usos:['fabricante','vehiculo']});
 await db.collection('modelosVehiculo').doc('v').set(model);
 const saved=(await pg.query('SELECT brand_id,brand_use,name FROM findi.vehicle_models WHERE id=$1',['v'])).rows[0];
 assert.equal(saved.brand_id,'brand');assert.equal(saved.brand_use,'vehiculo');
 assert.deepEqual((await pg.query('SELECT model_id,brand_id,family_id FROM findi.products WHERE id=$1',['product'])).rows[0],previous);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_models')).rows[0].n,1);
 await assert.rejects(db.collection('modelosVehiculo').doc('duplicate').set(model));
 await assert.rejects(db.collection('marcas').doc('brand').update({usos:['fabricante']}));
 assert.deepEqual((await db.collection('marcas').doc('brand').get()).data().usos,['fabricante','vehiculo']);
 let family=(await pg.query('SELECT supports_vehicle_applications,api_payload FROM findi.families WHERE id=$1',['family'])).rows[0];
 assert.equal(family.supports_vehicle_applications,false);assert.equal(family.api_payload.permiteVehiculos,false);
 await db.collection('familias').doc('family').update({permiteVehiculos:true});await db.collection('familias').doc('family').update({nombre:'Familia actualizada'});
 family=(await pg.query('SELECT supports_vehicle_applications,api_payload FROM findi.families WHERE id=$1',['family'])).rows[0];assert.equal(family.supports_vehicle_applications,true);assert.equal(family.api_payload.permiteVehiculos,true);
 await assert.rejects(db.collection('familias').doc('family').update({permiteVehiculos:'false'}),/FAMILY_VEHICLE_CAPABILITY_INVALID/);
});

test('offer vehicle associations remain relational, atomic and independent of old prices and quotation lines',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('familias').doc('family').update({permiteVehiculos:true});
 await db.collection('marcas').doc('brand').update({usos:['fabricante','vehiculo']});
 await db.collection('marcas').doc('other').set({nombre:'Otra marca',nombreNormalizado:'otra marca',usos:['vehiculo']});
 await db.collection('marcas').doc('brand').update({usos:['fabricante','vehiculo']});
 await db.collection('modelosVehiculo').doc('model').set({marcaId:'brand',nombre:'Modelo',nombreNormalizado:'modelo',activo:true});
 await db.collection('real_productosFerreteria').doc('offer').set({ferreteriaId:'store',productoMaestroId:'product',precio:1500,stock:2});
 const quote={ownerId:'master',name:'Cotización anterior',items:[{productName:'MDF negro 18 mm',quantity:1,productoMaestroId:'product',productoFerreteriaId:'offer'}],createdAt:'2026-10-08T12:00:00Z'};
 await db.collection('real_proyectos').doc('legacy-quote').set(quote);
 const declaration={marcaId:'brand',modeloId:'model',anioDesde:2000,anioHasta:2005,marcaNombre:'Marca de prueba',modeloNombre:'Modelo'};
 await db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[declaration]});
 assert.equal((await pg.query('SELECT model_id,brand_id,year_from,year_to FROM findi.offer_vehicle_applications')).rows[0].model_id,'model');
 await db.collection('familias').doc('family').update({permiteVehiculos:false});
 await db.collection('real_productosFerreteria').doc('offer').update({precio:1700});
 assert.deepEqual((await db.collection('real_productosFerreteria').doc('offer').get()).data().asociacionesVehiculos,[declaration]);
 await assert.rejects(db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[{...declaration,anioHasta:2006}]}),/FAMILY_VEHICLES_DISABLED/);
 await db.collection('familias').doc('family').update({permiteVehiculos:true});
 await assert.rejects(db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[{...declaration,marcaId:'other'}]}));
 await assert.rejects(db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[declaration,declaration]}),/VEHICLE_APPLICATION_OVERLAP/);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,1);
 assert.equal(Number((await pg.query('SELECT price FROM findi.offers WHERE id=$1',['offer'])).rows[0].price),1700);
 assert.deepEqual((await db.collection('real_proyectos').doc('legacy-quote').get()).data(),quote);
 await db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[]});assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,0);
 await db.collection('real_productosFerreteria').doc('offer').update({asociacionesVehiculos:[{...declaration,anioDesde:null,anioHasta:null}]});
 await db.collection('real_productosFerreteria').doc('offer').delete();assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offer_vehicle_applications')).rows[0].n,0);
});

test('generic auto-part seeds extend the shared catalog with reference images and no fabricated offers',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const {buildBaseAutoPartDocuments}=await import('../scripts/lib/base-auto-parts.mjs');
 const plan=JSON.parse(await readFile(new URL('../../docs/catalogo/catalogo-repuestos-base.json',import.meta.url),'utf8'));
 const records=buildBaseAutoPartDocuments(plan,'2026-10-13T12:00:00Z');
 const original=(await db.collection('productosMaestro').doc('product').get()).data();
 const batch=db.batch();for(const d of records)batch.set(db.collection(d.collection).doc(d.id),d.data);await batch.commit();
 assert.deepEqual((await db.collection('productosMaestro').doc('product').get()).data(),original);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.products')).rows[0].n,5);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offers')).rows[0].n,0);
 assert.equal((await pg.query("SELECT count(*)::int n FROM findi.families WHERE supports_vehicle_applications")).rows[0].n,4);
 for(const p of plan.products){const data=(await db.collection('productosMaestro').doc(p.id).get()).data();assert.equal(data.catalogoNivel,'tipo_base');assert.equal(data.imagenReferencial,true);assert.equal(data.origenImagen,'ai_generated');assert.equal(data.marcaId,null);assert.equal(data.precio,undefined);assert.equal(data.stock,undefined);}
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_media WHERE product_id=ANY($1::text[])',[plan.products.map(p=>p.id)])).rows[0].n,8);
});

test('SQL master variants persist compatibility and unique identity, inherit prices and preserve photos independently',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('familias').doc('radiators').set({nombre:'Radiadores',subcategoriaId:'sub',permiteVehiculos:true});
 await db.collection('marcas').doc('mahindra').set({nombre:'Mahindra',nombreNormalizado:'mahindra',usos:['vehiculo']});
 await db.collection('modelosVehiculo').doc('kuv').set({nombre:'KUV100',nombreNormalizado:'kuv100',marcaId:'mahindra',activo:true});
 const application={marcaId:'mahindra',modeloId:'kuv',marcaNombre:'untrusted',modeloNombre:'untrusted',anioDesde:2016,anioHasta:2019};
 const parent={nombre:'Wrong supplied title',nombrePieza:'Radiador',detalleVariante:'',familiaId:'radiators',categoriaId:'cat',subcategoriaId:'sub',marca:'Fabricante opcional',compatibilidadVehiculos:[application],estado:'activo',imagenPrincipalUrl:'/variant-a.webp'};
 await db.collection('productosMaestro').doc('early').set(parent);
 await db.collection('productosMaestro').doc('late').set({...parent,compatibilidadVehiculos:[{...application,anioDesde:2020,anioHasta:2023}],imagenPrincipalUrl:'/variant-b.webp'});
 const early=(await db.collection('productosMaestro').doc('early').get()).data();assert.equal(early.nombre,'Radiador Mahindra KUV100 2016–2019');assert.equal(early.compatibilidadVehiculos[0].marcaNombre,'Mahindra');
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.product_vehicle_applications')).rows[0].n,2);
 await assert.rejects(db.collection('productosMaestro').doc('duplicate').set(parent),/unique|duplicate/i);assert.equal((await db.collection('productosMaestro').doc('duplicate').get()).exists,false);
 await db.collection('real_ferreterias').doc('store').update({esPrueba:true});
 await db.collection('real_productosFerreteria').doc('early-offer').set({ferreteriaId:'store',productoMaestroId:'early',precio:10000,stock:2,activo:true,publicado:true});
 await assert.rejects(db.collection('real_productosFerreteria').doc('outside').set({ferreteriaId:'store',productoMaestroId:'late',precio:10000,stock:2,asociacionesVehiculos:[application]}),/OFFER_VEHICLES_OUTSIDE_PRODUCT/);
 await db.collection('productosMaestro').doc('early').update({imagenPrincipalUrl:'/new-specific-photo.webp'});
 assert.equal((await db.collection('productosMaestro').doc('late').get()).data().imagenPrincipalUrl,'/variant-b.webp');
 const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');const {paginateProductSearch}=await import('../lib/domain/product-search.js');
 const read=async c=>(await db.collection(c).get()).docs.map(d=>({id:d.id,...d.data()}));
 const source=await Promise.all(['real_productosFerreteria','productosMaestro','real_ferreterias','usuarios','categorias','subcategorias','familias'].map(read));
 const before=process.env.PILOT_STORES_ENABLED;process.env.PILOT_STORES_ENABLED='true';let searchRows;
 try{searchRows=await buildSearchRows(source);}finally{if(before===undefined)delete process.env.PILOT_STORES_ENABLED;else process.env.PILOT_STORES_ENABLED=before;}
 const snapshot={version:'master-test',updatedAt:'',products:source[1],searchRows,taxonomy:{categories:source[4],subcategories:source[5],families:source[6]}};
 const options={vehicleBrandId:'mahindra',vehicleModelId:'kuv',vehicleYear:2018,page:1,size:20,sort:'stores'};
 assert.equal(paginateProductSearch(snapshot,options).items[0].minPrice,10000);
 const late=paginateProductSearch(snapshot,{...options,vehicleYear:2021});assert.equal(late.total,1);assert.equal(late.items[0].storeCount,0);
});

test('store catalog CRUD persists junkyard parts and hardware offers through SQL, with ownership and duplicate protection', async t => {
 const {db}=await fixture(t);await catalog(db);
 await db.collection('categorias').doc('cat-repuestos-automotrices').set({nombre:'Repuestos automotrices'});
 await db.collection('subcategorias').doc('auto-motor').set({nombre:'Motor',categoriaId:'cat-repuestos-automotrices'});
 await db.collection('familias').doc('radiators').set({nombre:'Radiadores',subcategoriaId:'auto-motor',permiteVehiculos:true});
 await db.collection('marcas').doc('mahindra').set({nombre:'Mahindra',nombreNormalizado:'mahindra',usos:['vehiculo']});
 await db.collection('modelosVehiculo').doc('kuv').set({nombre:'KUV100',nombreNormalizado:'kuv100',marcaId:'mahindra',activo:true});
 const compatibility=[{marcaId:'mahindra',modeloId:'kuv',marcaNombre:'Mahindra',modeloNombre:'KUV100',anioDesde:2016,anioHasta:2019}];
 await db.collection('productosMaestro').doc('radiator').set({nombre:'Radiador Mahindra KUV100 2016–2019',nombrePieza:'Radiador',familiaId:'radiators',categoriaId:'cat-repuestos-automotrices',subcategoriaId:'auto-motor',compatibilidadVehiculos:compatibility,estado:'activo',imagenPrincipalUrl:'/radiator.webp'});
 const firebase=await import('../lib/lib/firebase.js');
 for(const method of ['collection','runTransaction','batch'])t.mock.method(firebase.db,method,db[method].bind(db));
 const {storeCatalogRouter}=await import('../lib/routes/store-catalog.routes.js');
 const {CURRENT_STORE_AGREEMENT_VERSION}=await import('../lib/lib/legal.js');
 const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
 const {COLLECTIONS}=await import('../lib/lib/collections.js');
 const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');
 const publicOffers=async storeId=>(await buildSearchRows()).filter(o=>o.storeId===storeId);
 const handler=method=>storeCatalogRouter.stack.find(l=>l.route?.path===`/ferreterias/:storeId/catalogo${['patch','delete'].includes(method)?'/:offerId':''}`&&l.route.methods[method]).route.stack.at(-1).handle;
 const call=async(method,storeId,body={},offerId='',owner='store-owner')=>{const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};await handler(method)({params:{storeId,offerId},authUserId:owner,authRole:'ferreteria',body},res);return res;};
 for(const [storeId,type] of [['store','ferreteria'],['junkyard','desarmaduria']]){
  const productId=type==='desarmaduria'?'radiator':'product';
  await db.collection(COLLECTIONS.stores).doc(storeId).set({usuarioDuenoId:'store-owner',nombreComercial:type,estado:'activo',tipoNegocio:type,contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()});
  await db.collection(COLLECTIONS.storeAgreements).doc('agreement-'+storeId).set({ferreteriaId:storeId,usuarioFirmanteId:'store-owner',version:CURRENT_STORE_AGREEMENT_VERSION,estado:'vigente',documentHash:storeAgreementDocumentHash(),proveedor:{},ferreteria:{},firmante:{},declaraciones:{},evidencia:{source:'isolated-crud-test'},aceptadoEn:new Date().toISOString()});
  const created=await call('post',storeId,{productoMaestroId:productId,precio:25000,stock:2,condicion:type==='desarmaduria'?'usado':'nuevo',publicado:true});
  assert.equal(created.statusCode,201);const id=created.body.data.id;
  assert.equal((await publicOffers(storeId))[0].comparisonEligible,true);
  const duplicate=await call('post',storeId,{productoMaestroId:productId,precio:25000,stock:2});assert.equal(duplicate.statusCode,409);
  const read=await call('get',storeId);assert.equal(read.body.data.length,1);
  assert.equal(read.body.data[0].productoMaestro.nombre,type==='desarmaduria'?'Radiador Mahindra KUV100 2016–2019':'MDF negro 18 mm');
  if(type==='desarmaduria')assert.deepEqual(read.body.data[0].productoMaestro.compatibilidadVehiculos,compatibility);
  assert.equal((await call('get',storeId,{},'', 'other-owner')).statusCode,403);
  assert.equal((await call('patch',storeId,{precio:1},id,'other-owner')).statusCode,403);
  assert.equal((await call('delete',storeId,{},id,'other-owner')).statusCode,403);
  const edited=await call('patch',storeId,{precio:27000,stock:0,condicion:'reacondicionado',publicado:false,condicionesOferta:'Retiro en local'},id);
  assert.equal(edited.statusCode,200);assert.equal(edited.body.data.precio,27000);assert.equal(edited.body.data.stock,0);assert.equal(edited.body.data.publicado,false);assert.equal(edited.body.data.condicion,'reacondicionado');
  assert.equal((await publicOffers(storeId)).length,0);
  assert.equal((await call('patch',storeId,{publicado:true,stock:1},id)).statusCode,200);
  const visible=(await publicOffers(storeId))[0];assert.equal(visible.price,27000);assert.equal(visible.condition,'reacondicionado');
  if(type==='desarmaduria')assert.equal(visible.vehicleApplications[0].anioHasta,2019);
  assert.equal((await call('delete',storeId,{},id)).statusCode,200);assert.equal((await call('get',storeId)).body.data.length,0);
  assert.equal((await publicOffers(storeId)).length,0);
  assert.equal((await call('delete',storeId,{},id)).statusCode,404);
  const history=(await db.collection(COLLECTIONS.priceHistory).get()).docs.map(d=>d.data()).filter(h=>h.ferreteriaId===storeId);
  assert.deepEqual(history.map(h=>h.action).sort(),['created','deleted','updated','updated']);
  assert.ok(history.every(h=>h.productoFerreteriaId===id));
  assert.equal((await call('post',storeId,{productoMaestroId:productId,precio:25000,stock:1})).statusCode,201);
 }
});

test('owned photo galleries persist atomically in SQL without changing master images or another local offer',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('real_productosFerreteria').doc('photo-offer').set({ferreteriaId:'store',productoMaestroId:'product',precio:10000,stock:1,condicion:'usado',activo:true,publicado:true});
 await db.collection('real_ferreterias').doc('other-store').set({usuarioDuenoId:'store-owner',nombreComercial:'Other',estado:'activo'});
 await db.collection('real_productosFerreteria').doc('other-offer').set({ferreteriaId:'other-store',productoMaestroId:'product',precio:15000,stock:2,activo:true,publicado:true});
 const firebase=await import('../lib/lib/firebase.js');for(const method of ['collection','runTransaction','batch'])t.mock.method(firebase.db,method,db[method].bind(db));
 const {changeOfferPhotos}=await import('../lib/services/offer-photos.service.js');
 const photo={id:'photo',url:'https://cdn.example/own.webp',thumbnailUrl:'https://cdn.example/thumb.webp',storagePath:'owned/main',thumbnailPath:'owned/thumb',uploadedAt:new Date().toISOString(),uploadedBy:'store-owner'};
 const masterBefore=(await db.collection('productosMaestro').doc('product').get()).data();
 await changeOfferPhotos('store','photo-offer','store-owner',false,()=>[photo]);
 assert.deepEqual((await pg.query("SELECT api_payload->'fotosPublicacion' photos FROM findi.offers WHERE id='photo-offer'")).rows[0].photos,[photo]);
 await assert.rejects(changeOfferPhotos('store','photo-offer','intruder',false,()=>[]),e=>e.status===403);
 assert.equal((await db.collection('real_productosFerreteria').doc('photo-offer').get()).data().fotosPublicacion.length,1);
 assert.equal((await db.collection('real_productosFerreteria').doc('other-offer').get()).data().fotosPublicacion,undefined);
 assert.deepEqual((await db.collection('productosMaestro').doc('product').get()).data(),masterBefore);
 await changeOfferPhotos('store','photo-offer','store-owner',false,()=>[]);
 assert.deepEqual((await db.collection('real_productosFerreteria').doc('photo-offer').get()).data().fotosPublicacion,[]);
 assert.equal((await pg.query("SELECT count(*)::int n FROM findi.offer_history WHERE offer_reference='photo-offer' AND action='photos_updated'")).rows[0].n,2);
});

test('product business scope persists across unrelated SQL updates and rejects invalid values',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);const ref=db.collection('productosMaestro').doc('product');
 assert.equal((await ref.get()).data().ambitoComercial,'ferreteria');
 await ref.update({ambitoComercial:'ambos'});await ref.update({descripcionCorta:'Se conserva la clasificación'});
 assert.equal((await ref.get()).data().ambitoComercial,'ambos');
 assert.equal((await pg.query("SELECT api_payload->>'ambitoComercial' AS scope FROM findi.products WHERE id='product'")).rows[0].scope,'ambos');
 await assert.rejects(ref.update({ambitoComercial:'todo'}),/PRODUCT_BUSINESS_SCOPE_INVALID/);
 assert.equal((await ref.get()).data().ambitoComercial,'ambos');
});

test('donor SQL permits separate sourced offers, keeps regular uniqueness and enforces vehicle ownership',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 await db.collection('real_ferreterias').doc('store').update({tipoNegocio:'desarmaduria'});
 await db.collection('marcas').doc('brand').update({usos:['fabricante','vehiculo']});
 await db.collection('modelosVehiculo').doc('model').set({marcaId:'brand',nombre:'KUV100',nombreNormalizado:'kuv100',activo:true});
 const donor={ferreteriaId:'store',marcaId:'brand',modeloId:'model',anio:2018,estado:'en_desarme',piezas:[],revision:1};
 for(const id of ['donor-a','donor-b'])await db.collection('real_vehiculosDonantes').doc(id).set(donor);
 await pg.query('SET search_path=public,pg_catalog'); // Match the runtime connection instead of the migration session.
 const base={ferreteriaId:'store',productoMaestroId:'product',precio:30000,stock:1,condicion:'usado',activo:true,publicado:true};
 for(const donorId of ['donor-a','donor-b'])await db.collection('real_productosFerreteria').doc('offer-'+donorId).set({...base,vehiculoDonanteId:donorId,piezaDonanteId:'radiator'});
 await db.collection('real_productosFerreteria').doc('regular').set(base);
 await assert.rejects(db.collection('real_productosFerreteria').doc('regular-duplicate').set(base),e=>e.code==='23505');
 await assert.rejects(db.collection('real_productosFerreteria').doc('donor-duplicate').set({...base,vehiculoDonanteId:'donor-a',piezaDonanteId:'radiator'}),e=>e.code==='23505');
 await db.collection('usuarios').doc('other-owner').set({rol:'ferreteria',nombre:'Other',correo:'other@example.test'});
 await db.collection('real_ferreterias').doc('other-store').set({usuarioDuenoId:'other-owner',nombreComercial:'Other',tipoNegocio:'desarmaduria'});
 await assert.rejects(db.collection('real_productosFerreteria').doc('stolen').set({...base,ferreteriaId:'other-store',vehiculoDonanteId:'donor-a',piezaDonanteId:'x'}),e=>e.code==='23503');
 await assert.rejects(db.collection('real_vehiculosDonantes').doc('donor-a').delete(),e=>['23503','23001'].includes(e.code));
 const result=(await pg.query('SELECT donor_vehicle_id,donor_item_id FROM findi.offers WHERE id=$1',['offer-donor-a'])).rows[0];assert.deepEqual(result,{donor_vehicle_id:'donor-a',donor_item_id:'radiator'});
 assert.equal((await db.collection('real_productosFerreteria').get()).size,3);
});

test('SQL publishes proposed tools and donor tires atomically with taxonomy, review and retry protection', async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const firebase=await import('../lib/lib/firebase.js');for(const method of ['collection','runTransaction','batch'])t.mock.method(firebase.db,method,db[method].bind(db));
 const {publishProposedProduct}=await import('../lib/services/proposed-product.service.js');
 const {saveDonor,publishDonorPart}=await import('../lib/services/donor-vehicles.service.js');
 const result=await publishProposedProduct('store','store-owner',{name:'Taladro nuevo SQL',area:'herramientas',price:25000,stock:3});
 assert.equal((await db.collection('real_productosFerreteria').doc(result.productoFerreteriaId).get()).data().publicado,true);
 assert.equal((await db.collection('real_solicitudesCreacionProducto').doc(result.id).get()).data().estado,'pendiente');
 await publishProposedProduct('store','store-owner',{name:'Taladro nuevo SQL',area:'herramientas',price:100,stock:1});
 assert.equal((await db.collection('real_productosFerreteria').doc(result.productoFerreteriaId).get()).data().precio,25000);
 await db.collection('usuarios').doc('junk-owner').set({rol:'ferreteria',nombre:'Junk',correo:'junk@example.test',estadoCuenta:'activo'});
 await db.collection('real_ferreterias').doc('junk').set({usuarioDuenoId:'junk-owner',nombreComercial:'Junk',estado:'activo',tipoNegocio:'desarmaduria'});
 await db.collection('marcas').doc('vehicle-brand').set({nombre:'Marca V',usos:['vehiculo']});
 await db.collection('modelosVehiculo').doc('vehicle-model').set({nombre:'Modelo V',nombreNormalizado:'modelo v',marcaId:'vehicle-brand',activo:true});
 const vehicleId='11111111-1111-4111-8111-111111111111';
 await saveDonor('junk',vehicleId,{marcaId:'vehicle-brand',modeloId:'vehicle-model',anio:2018,motor:'1.2',piezas:[{id:'tire',nombre:'Neumático',sistema:'Suspensión y dirección',seleccionada:true,precio:20000,stock:1,condicion:'usado',productoMaestroId:null}]},'junk-owner',false);
 const publication=await publishDonorPart('junk',vehicleId,'tire','junk-owner',false);assert.equal(publication.estado,'publicada');
 const offer=(await db.collection('real_productosFerreteria').doc(publication.ofertaId).get()).data();
 const master=(await db.collection('productosMaestro').doc(offer.productoMaestroId).get()).data();
 const family=(await db.collection('familias').doc(master.familiaId).get()).data();
 assert.equal(master.categoriaId,'cat-repuestos-automotrices');assert.equal(family.nombre,'Neumático');assert.equal(family.permiteVehiculos,true);assert.equal(master.validacionPendiente,true);
 const before=(await pg.query('SELECT count(*)::int n FROM findi.offers')).rows[0].n;
 await publishDonorPart('junk',vehicleId,'tire','junk-owner',false);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.offers')).rows[0].n,before);
});
