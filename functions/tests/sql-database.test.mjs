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
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','011-quotation-verification.sql','012-advisory-quotation-period.sql','013-store-reviews.sql','015-offer-condition.sql','016-store-business-type.sql','017-vehicle-reference-catalog.sql','018-offer-vehicle-applications.sql','019-product-vehicle-applications.sql','020-donor-vehicles.sql','021-donor-trigger-search-path.sql','023-hardware-only.sql'].filter(file=>includeCondition||file!=='015-offer-condition.sql'))await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
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
test('HTTP quotation lifecycle enforces roles and ownership while persisting frozen and renewed SQL prices',async context=>{
 const {db,pg}=await fixture(context);await catalog(db);
 const express=(await import('express')).default;
 const firebase=await import('../lib/lib/firebase.js');
 const {projectsRouter}=await import('../lib/routes/projects.routes.js');
 const {storeCatalogRouter}=await import('../lib/routes/store-catalog.routes.js');
 const {searchRouter}=await import('../lib/routes/search.routes.js');
 const {CURRENT_TERMS_VERSION,CURRENT_PRIVACY_VERSION,CURRENT_STORE_AGREEMENT_VERSION,STORE_AGREEMENT_PROVIDER}=await import('../lib/lib/legal.js');
 const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
 const legal={terminosVersion:CURRENT_TERMS_VERSION,privacidadVersion:CURRENT_PRIVACY_VERSION,mayoriaEdadDeclarada:true};
 await db.collection('usuarios').doc('master').update(legal);
 await db.collection('usuarios').doc('store-owner').update(legal);
 await db.collection('usuarios').doc('other-master').set({...legal,rol:'maestro',nombre:'Other',correo:'other@example.test',estadoCuenta:'activo'});
 const documentHash=storeAgreementDocumentHash();
 await db.collection('real_contratosFerreteria').doc('agreement').set({ferreteriaId:'store',usuarioFirmanteId:'store-owner',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash,estado:'vigente',proveedor:STORE_AGREEMENT_PROVIDER,ferreteria:{nombreComercial:'Local'},firmante:{nombre:'Local'},declaraciones:{aceptacionIntegra:true},evidencia:{source:'store_onboarding'},aceptadoEn:new Date().toISOString()});
 await db.collection('real_ferreterias').doc('store').update({contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:documentHash});
 await db.collection('real_productosFerreteria').doc('offer').set({ferreteriaId:'store',productoMaestroId:'product',precio:1500,stock:20,incluyeIva:true,activo:true,publicado:true});
 for(const method of ['collection','runTransaction','batch'])context.mock.method(firebase.db,method,db[method].bind(db));
 context.mock.method(firebase.adminAuth,'verifyIdToken',async token=>{
  const uid={master:'master',other:'other-master',store:'store-owner'}[token];
  if(!uid)throw new Error('Invalid test token');
  return {uid};
 });
 const app=express();app.use(express.json());app.use('/api',projectsRouter,storeCatalogRouter,searchRouter);
 const server=app.listen(0,'127.0.0.1');
 context.after(()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();}));
 await new Promise(resolve=>server.once('listening',resolve));
 const origin=`http://127.0.0.1:${server.address().port}/api`;
 const request=async(method,path,token,body)=>{
  const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
 };
 const path='/maestros/master/proyectos';
 const item={productName:'MDF negro 18 mm',productoMaestroId:'product',storeId:'store',productoFerreteriaId:'offer',quantity:2};
 const input={nombre:'HTTP obra',items:[item]};
 const searchPath='/busqueda?vista=productos&ferreteriaId=store';
 const initialSearch=await request('GET',searchPath);
 assert.equal(initialSearch.status,200,JSON.stringify(initialSearch.body));
 assert.equal(initialSearch.body.data.items[0].minPrice,1500);
 const slug=initialSearch.body.data.items[0].seoPath.split('/').pop();
 const detailPath='/productos/detalle?vista=ofertas&slug='+encodeURIComponent(slug);
 assert.equal((await request('GET',detailPath)).body.data.stores[0].price,1500);
 assert.equal((await request('POST',path,undefined,input)).status,401);
 assert.equal((await request('POST',path,'store',input)).status,403);
 assert.equal((await request('POST',path,'other',input)).status,403);
 const created=await request('POST',path,'master',input);
 assert.equal(created.status,201,JSON.stringify(created.body));
 assert.equal(created.body.data.totalOptimal,3000);
 const projectPath=path+'/'+created.body.data.id;
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_items')).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_verifications')).rows[0].n,1);
 assert.equal((await request('GET',projectPath,'other')).status,403);
 assert.equal((await request('PUT',projectPath,'other',input)).status,403);
 assert.equal((await request('DELETE',projectPath,'other')).status,403);
 const offerPath='/ferreterias/store/catalogo/offer';
 assert.equal((await request('PATCH',offerPath,'other',{precio:9000})).status,403);
 const changedPrice=await request('PATCH',offerPath,'store',{precio:9000});
 assert.equal(changedPrice.status,200,JSON.stringify(changedPrice.body));
 assert.equal((await request('GET',searchPath)).body.data.items[0].minPrice,9000);
 assert.equal((await request('GET',detailPath)).body.data.stores[0].price,9000);
 assert.equal((await request('GET',projectPath,'master')).body.data.totalOptimal,3000);
 const added=await request('POST',projectPath+'/items','master',{...item,quantity:1});
 assert.equal(added.status,201,JSON.stringify(added.body));
 assert.equal(added.body.data.totalOptimal,4500);
 assert.equal(added.body.data.validUntil,created.body.data.validUntil);
 const renewed=await request('PUT',projectPath,'master',{nombre:'HTTP editada',items:added.body.data.items,renovarPrecios:true});
 assert.equal(renewed.status,200,JSON.stringify(renewed.body));
 assert.equal(renewed.body.data.totalOptimal,27000);
 assert.notEqual(renewed.body.data.verificationCode,created.body.data.verificationCode);
 assert.equal((await request('PATCH',offerPath,'store',{activo:false})).status,200);
 assert.equal((await request('GET',searchPath)).body.data.total,0);
 assert.equal((await request('GET',detailPath)).body.data.stores.length,0);
 assert.equal((await request('POST',path,'master',{nombre:'Segunda',items:[]})).status,201);
 assert.equal((await request('POST',path,'master',{nombre:'Tercera',items:[]})).status,409);
 assert.equal((await request('GET',path,'master')).body.data.length,2);
 assert.equal((await request('DELETE',projectPath,'master')).status,200);
 assert.equal((await request('GET',projectPath,'master')).status,404);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_items')).rows[0].n,0);
});
test('repository returns document identity instead of a payload id across reads and writes',async t=>{
 const {db}=await fixture(t);
 const firebase=await import('../lib/lib/firebase.js');
 for(const method of ['collection','runTransaction','batch'])t.mock.method(firebase.db,method,db[method].bind(db));
 const {rows,row,createRow,patchRow}=await import('../lib/repositories/firestore.repository.js');
 const created=await createRow('categorias',{id:'payload-id',nombre:'Original'},'document-id');
 assert.equal(created.id,'document-id');
 assert.equal((await row('categorias','document-id')).id,'document-id');
 assert.equal((await rows('categorias'))[0].id,'document-id');
 assert.equal((await patchRow('categorias','document-id',{id:'changed-payload-id',nombre:'Updated'})).id,'document-id');
 assert.equal((await db.collection('categorias').doc('document-id').get()).data().nombre,'Updated');
 assert.equal((await db.collection('categorias').doc('payload-id').get()).exists,false);
});
test('SQL transactions reject foreign collection queries as well as document references',async t=>{
 const {db,pool}=await fixture(t);
 const other=new PostgresDatabase(pool);
 await db.collection('categorias').doc('local').set({nombre:'Local'});
 for(const reference of [other.collection('categorias'),other.collection('categorias').where('nombre','==','Local').limit(1),other.collection('categorias').doc('local')]){
  await assert.rejects(db.runTransaction(tx=>tx.get(reference)),/SQL_FOREIGN_REFERENCE/);
 }
 const snapshot=await db.runTransaction(tx=>tx.get(db.collection('categorias').where('nombre','==','Local').limit(1)));
 assert.deepEqual(snapshot.docs.map(doc=>doc.id),['local']);
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
test('blocked-account migration preserves existing profiles and makes the auth block persistable',async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const before=(await db.collection('usuarios').doc('master').get()).data();
 await assert.rejects(db.collection('usuarios').doc('master').update({estadoCuenta:'bloqueado'}));
 await pg.exec(await readFile(new URL('../../sql/findi/022-blocked-account-status.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.collection('usuarios').doc('master').get()).data(),before);
 await db.collection('usuarios').doc('master').update({estadoCuenta:'bloqueado'});
 assert.equal((await pg.query("SELECT account_status FROM findi.users WHERE id='master'")).rows[0].account_status,'bloqueado');
 assert.equal((await db.collection('usuarios').doc('master').get()).data().estadoCuenta,'bloqueado');
 const firebase=await import('../lib/lib/firebase.js');
 const {requireAuth}=await import('../lib/lib/auth.js');
 t.mock.method(firebase.db,'collection',db.collection.bind(db));
 t.mock.method(firebase.adminAuth,'verifyIdToken',async()=>({uid:'master'}));
 let status;let body;let continued=false;
 const res={status(value){status=value;return this;},json(value){body=value;return this;}};
 await requireAuth({header:()=> 'Bearer local-test',originalUrl:'/api/maestros/master/proyectos'},res,()=>{continued=true;});
 assert.equal(status,403);assert.equal(body.error.code,'AUTH_ACCOUNT_BLOCKED');assert.equal(continued,false);
 await assert.rejects(db.collection('usuarios').doc('master').update({estadoCuenta:'unknown'}));
 await db.collection('usuarios').doc('master').update({estadoCuenta:'activo'});
 assert.equal((await pg.query("SELECT account_status FROM findi.users WHERE id='master'")).rows[0].account_status,'activo');
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
 await assert.rejects(db.collection('real_ferreterias').doc('store').update({tipoNegocio:'desarmaduria'}),/BUSINESS_TYPE_INVALID/);
 store=(await pg.query('SELECT owner_id,business_type,api_payload FROM findi.stores WHERE id=$1',['store'])).rows[0];
 assert.equal(store.owner_id,'store-owner');assert.equal(store.business_type,'ferreteria');assert.equal(store.api_payload.tipoNegocio,'ferreteria');
 assert.equal((await db.collection('usuarios').doc('store-owner').get()).data().rol,'ferreteria');
 await assert.rejects(db.collection('real_ferreterias').doc('store').update({tipoNegocio:'admin'}),/BUSINESS_TYPE_INVALID/);
 await assert.rejects(pg.query("UPDATE findi.stores SET business_type='admin' WHERE id='store'"));
});

test('store catalog CRUD supports hardware offers and rejects retired stores through SQL', async t => {
 const {db}=await fixture(t);await catalog(db);
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
 for(const [storeId,type] of [['store','ferreteria']]){
  const productId='product';
  await db.collection(COLLECTIONS.stores).doc(storeId).set({usuarioDuenoId:'store-owner',nombreComercial:type,estado:'activo',tipoNegocio:type,contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()});
  await db.collection(COLLECTIONS.storeAgreements).doc('agreement-'+storeId).set({ferreteriaId:storeId,usuarioFirmanteId:'store-owner',version:CURRENT_STORE_AGREEMENT_VERSION,estado:'vigente',documentHash:storeAgreementDocumentHash(),proveedor:{},ferreteria:{},firmante:{},declaraciones:{},evidencia:{source:'isolated-crud-test'},aceptadoEn:new Date().toISOString()});
  const created=await call('post',storeId,{productoMaestroId:productId,precio:25000,stock:2,condicion:'nuevo',publicado:true});
  assert.equal(created.statusCode,201);const id=created.body.data.id;
  assert.equal((await publicOffers(storeId))[0].comparisonEligible,true);
  const duplicate=await call('post',storeId,{productoMaestroId:productId,precio:25000,stock:2});assert.equal(duplicate.statusCode,409);
  const read=await call('get',storeId);assert.equal(read.body.data.length,1);
  assert.equal(read.body.data[0].productoMaestro.nombre,'MDF negro 18 mm');
  assert.equal((await call('get',storeId,{},'', 'other-owner')).statusCode,403);
  assert.equal((await call('patch',storeId,{precio:1},id,'other-owner')).statusCode,403);
  assert.equal((await call('delete',storeId,{},id,'other-owner')).statusCode,403);
  const edited=await call('patch',storeId,{precio:27000,stock:0,condicion:'reacondicionado',publicado:false,condicionesOferta:'Retiro en local'},id);
  assert.equal(edited.statusCode,200);assert.equal(edited.body.data.precio,27000);assert.equal(edited.body.data.stock,0);assert.equal(edited.body.data.publicado,false);assert.equal(edited.body.data.condicion,'reacondicionado');
  assert.equal((await publicOffers(storeId)).length,0);
  assert.equal((await call('patch',storeId,{publicado:true,stock:1},id)).statusCode,200);
  const visible=(await publicOffers(storeId))[0];assert.equal(visible.price,27000);assert.equal(visible.condition,'reacondicionado');
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
 await assert.rejects(ref.update({ambitoComercial:'ambos'}),/PRODUCT_BUSINESS_SCOPE_INVALID/);await ref.update({descripcionCorta:'Se conserva la clasificación'});
 assert.equal((await ref.get()).data().ambitoComercial,'ferreteria');
 assert.equal((await pg.query("SELECT api_payload->>'ambitoComercial' AS scope FROM findi.products WHERE id='product'")).rows[0].scope,'ferreteria');
 await assert.rejects(ref.update({ambitoComercial:'todo'}),/PRODUCT_BUSINESS_SCOPE_INVALID/);
 assert.equal((await ref.get()).data().ambitoComercial,'ferreteria');
});

test('SQL publishes proposed hardware tools with retry protection and rejects retired local types', async t=>{
 const {db,pg}=await fixture(t);await catalog(db);
 const firebase=await import('../lib/lib/firebase.js');for(const method of ['collection','runTransaction','batch'])t.mock.method(firebase.db,method,db[method].bind(db));
 const {publishProposedProduct}=await import('../lib/services/proposed-product.service.js');
 const result=await publishProposedProduct('store','store-owner',{name:'Taladro nuevo SQL',area:'herramientas',price:25000,stock:3});
 assert.equal((await db.collection('real_productosFerreteria').doc(result.productoFerreteriaId).get()).data().publicado,true);
 assert.equal((await db.collection('real_solicitudesCreacionProducto').doc(result.id).get()).data().estado,'pendiente');
 await publishProposedProduct('store','store-owner',{name:'Taladro nuevo SQL',area:'herramientas',price:100,stock:1});
 assert.equal((await db.collection('real_productosFerreteria').doc(result.productoFerreteriaId).get()).data().precio,25000);
 await db.collection('usuarios').doc('junk-owner').set({rol:'ferreteria',nombre:'Junk',correo:'junk@example.test',estadoCuenta:'activo'});
 await assert.rejects(db.collection('real_ferreterias').doc('junk').set({usuarioDuenoId:'junk-owner',nombreComercial:'Junk',estado:'activo',tipoNegocio:'desarmaduria'}),/BUSINESS_TYPE_INVALID/);
 await assert.rejects(publishProposedProduct('store','store-owner',{name:'Pieza retirada',area:'repuestos',price:20000,stock:1}),error=>error.code==='PRODUCT_AREA_INVALID');

});
