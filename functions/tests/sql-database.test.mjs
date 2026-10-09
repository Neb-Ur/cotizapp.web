import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {FieldValue} from 'firebase-admin/firestore';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {replicateDocument} from '../lib/database/replication.js';
import {useSqlDatabase} from '../lib/database/config.js';
async function fixture(t,ready=true){
 const pg=new PGlite();
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql'])await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
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
