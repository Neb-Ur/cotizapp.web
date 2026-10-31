import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../lib/database/postgres.js';
import {compactDocumentSql,sqlTableName} from '../lib/database/compact.js';
import {applySchemaMigrations,HISTORICAL_MIGRATIONS} from '../scripts/lib/schema-migrations.mjs';
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
async function fixture(t){
 const original=process.env.SQL_SCHEMA_VARIANT;delete process.env.SQL_SCHEMA_VARIANT;
 t.after(()=>{if(original===undefined)delete process.env.SQL_SCHEMA_VARIANT;else process.env.SQL_SCHEMA_VARIANT=original;});
 const pg=new PGlite();t.after(()=>pg.close());
 const migrationClient={query:async(sql,params)=>params?pg.query(sql,params):(await pg.exec(sql)).at(-1)};
 await applySchemaMigrations(migrationClient);
 await pg.query("INSERT INTO findi.database_migration_state(id,status,source_project,verified_at,manifest) VALUES('firestore-to-sql','active','fixture',now(),'{\"baseline\":true,\"writesPaused\":false}')");
 const db=new PostgresDatabase({connect:async()=>({query:pg.query.bind(pg),release(){}})});
 return {pg,db,async compact(){await applySchemaMigrations(migrationClient,{migrations:[...HISTORICAL_MIGRATIONS,'025-compact-schema.sql']});process.env.SQL_SCHEMA_VARIANT='compact';}};
}
async function catalog(db){
 const put=(collection,id,data)=>db.collection(collection).doc(id).set(data);
 await put('usuarios','admin',{rol:'admin',nombre:'Admin',correo:'admin@example.test',estadoCuenta:'activo',telefono:null,creadoEn:'2026-10-01T12:00:00Z',actualizadoEn:'2026-10-01T12:00:00.123Z',professionalTools:{version:1,clients:[{name:'Cliente'}]},unknown:{keep:[false,0,null]}});
 await put('usuarios','owner',{rol:'ferreteria',nombre:'Dueño',correo:'owner@example.test',estadoCuenta:'activo'});
 await put('usuarios','master',{rol:'maestro',nombre:'Maestro',correo:'master@example.test',estadoCuenta:'activo'});
 await put('categorias','cat',{nombre:'Materiales',icono:'box'});
 await put('subcategorias','sub',{nombre:'Pinturas',categoriaId:'cat'});
 await put('familias','family',{nombre:'Pinturas látex',subcategoriaId:'sub'});
 await put('marcas','brand',{nombre:'Marca',nombreNormalizado:'marca',usos:['fabricante']});
 await put('definicionesAtributoFamilia','definition',{familiaId:'family',codigo:'rendimiento',etiqueta:'Rendimiento',tipoDato:'numero',orden:1,esFiltrable:true,esObligatorio:false});
 const primary='https://cdn.example/catalog/original.webp',thumb='https://cdn.example/catalog/thumb.webp',external='https://source.example/original.jpg';
 await put('productosMaestro','product',{nombre:'Pintura',categoriaId:'cat',subcategoriaId:'sub',familiaId:'family',marcaId:'brand',marca:'Marca',modelo:'Látex',codigoFabricante:'LTX',evidenciaCatalogo:{source:'Ficha'},estado:'activo',pesoLogisticoKg:'01.50',caracteristicasDestacadas:['Lavable','Interior'],imagenPrincipalUrl:primary,imagenStorageUrl:primary,imagenStoragePath:'catalog/original.webp',imagenMiniaturaUrl:thumb,imagenMiniaturaPath:'catalog/thumb.webp',imagenExternaUrl:external,galeriaJson:[primary,external],origenImagen:'generada',referenciaAutorizacion:'fixture-image-rights',derechosRevisadosPor:'admin',referenciaDerechosContenido:'fixture-text-rights',derechosContenidoRevisadosPor:'admin',calculationSpecs:{version:1,saleUnit:'unidad'},creadoEn:'2026-10-01T12:00:00.123Z'});
 await put('atributosProductoMaestro','attribute',{productoMaestroId:'product',definicionAtributoId:'definition',codigo:'rendimiento',etiqueta:'Rendimiento',valorNumero:9.5});
 await put('real_ferreterias','store',{usuarioDuenoId:'owner',nombreComercial:'Ferretería',estado:'activo',esPrueba:false});
 await put('real_productosFerreteria','offer',{ferreteriaId:'store',productoMaestroId:'product',precio:5490.5,stock:2,condicion:'nuevo',activo:true,publicado:true,incluyeIva:true,vigenteDesde:'2026-10-01T12:00:00Z',fotosPublicacion:[{id:'own',url:'https://cdn.example/offer.webp',storageImagePath:'offer/original.webp'}]});
 const items=[{productName:'Pintura',productoMaestroId:'product',quantity:2,storeId:'store',productoFerreteriaId:'offer',calculationSource:'painting'}];
 await put('real_proyectos','project',{ownerId:'master',name:'Obra',nombre:'Alias distinto',createdAt:'2026-10-01T12:00:00.000Z',items,singleStoreId:'store',singleStoreName:'Ferretería',workBudget:{version:1,labor:[{description:'Jornada',quantity:1,unitPrice:25000}]},pricingOffers:[{productoMaestroId:'product',price:5490.5,stock:2,storeId:'store',productName:'Pintura'}],pricesCapturedAt:'2026-10-01T12:00:00Z',validUntil:'2026-10-08T12:00:00Z',ledger:{version:1,revision:2,entries:[]},workflowStatus:'draft'});
 await put('real_cotizacionesVerificables','CODE',{code:'CODE',quotationReference:'project',issuedAt:'2026-10-01T12:00:00.000Z',recommendedUntil:'2026-10-08T12:00:00.000Z',lines:[{storeId:'store',productName:'Pintura',quantity:2,unitPrice:5490.5}],unknownSnapshot:{keep:true}});
}
const collections=['usuarios','categorias','subcategorias','familias','marcas','definicionesAtributoFamilia','productosMaestro','atributosProductoMaestro','real_ferreterias','real_productosFerreteria','real_proyectos','real_cotizacionesVerificables'];
async function snapshot(db){const result={};for(const collection of collections){const value=await db.collection(collection).get();result[collection]=value.docs.map(doc=>({id:doc.id,data:doc.data()}));}return result;}
test('compact migration preserves exact DTO hashes, sparse fields, media rights and frozen snapshots',async t=>{
 const {pg,db,compact}=await fixture(t);await catalog(db);const before=await snapshot(db);
 const ledger=(await pg.query('SELECT version,sha256 FROM public.findi_schema_migrations ORDER BY version')).rows;
 await pg.query("UPDATE findi.database_migration_state SET manifest=manifest || jsonb_build_object('writesPaused',true)");await compact();
 assert.deepEqual((await pg.query("SELECT version,sha256 FROM public.findi_schema_migrations WHERE version<>'025-compact-schema.sql' ORDER BY version")).rows,ledger);
 assert.equal(sqlTableName('offers'),'store_products');assert.equal((await pg.query("SELECT to_regclass('findi.offers') old_name")).rows[0].old_name,null);
 assert.equal(hash(await snapshot(db)),hash(before));assert.deepEqual(await snapshot(db),before);
 const removed=(await pg.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='findi' AND column_name='api_payload'")).rows;assert.deepEqual(removed,[]);
 assert.deepEqual((await pg.query("SELECT to_regclass('findi.product_features') features,to_regclass('findi.product_media') media,to_regnamespace('findi_inspection') inspection,to_regnamespace('findi_migration') migration")).rows[0],{features:null,media:null,inspection:null,migration:null});
 const state=(await pg.query("SELECT status,manifest FROM findi.app_state WHERE id='baseline'")).rows[0];assert.deepEqual(state,{status:'ready',manifest:{baseline:true}});
 const user=(await pg.query("SELECT api_fields,api_extra FROM findi.users WHERE id='admin'")).rows[0];
 assert.equal(user.api_fields.nombre,'string');assert.equal(user.api_fields.actualizadoEn,'string');assert.equal(user.api_extra.creadoEn,'2026-10-01T12:00:00Z');assert.ok(!Object.hasOwn(user.api_extra,'nombre'));assert.ok(user.api_extra.professionalTools);
 const product=(await pg.query("SELECT features,api_extra FROM findi.products WHERE id='product'")).rows[0];assert.deepEqual(product.features,['Lavable','Interior']);assert.equal(product.api_extra.pesoLogisticoKg,'01.50');assert.ok(!Object.hasOwn(product.api_extra,'caracteristicasDestacadas'));
 const media=(await pg.query("SELECT url,storage_path,origin,rights_id,is_primary,in_gallery FROM findi.media_assets WHERE product_id='product' ORDER BY position")).rows;
 assert.equal(media.length,3);assert.equal(media[0].is_primary,true);assert.equal(media[0].storage_path,'catalog/original.webp');assert.equal(media[1].origin,'external_url');assert.equal(media[1].rights_id,null);assert.ok(media[0].rights_id);
 const rights=(await pg.query('SELECT authorization_reference,reviewed_by FROM findi.content_rights ORDER BY authorization_reference')).rows;assert.deepEqual(rights,[{authorization_reference:'fixture-image-rights',reviewed_by:'admin'},{authorization_reference:'fixture-text-rights',reviewed_by:'admin'}]);
 await assert.rejects(db.collection('real_cotizacionesVerificables').doc('CODE').update({unknownSnapshot:{keep:false}}),/QUOTATION_VERIFICATION_IMMUTABLE/);
 await pg.query('SET ROLE findi_backend');
 try{assert.equal((await pg.query("SELECT status FROM findi.app_state WHERE id='baseline'")).rows[0].status,'ready');await assert.rejects(pg.query("UPDATE findi.app_state SET status='building' WHERE id='baseline'"),/permission denied/);}finally{await pg.query('RESET ROLE');}
});
test('compact reads typed values, preserves unknown fields, missing/null filters and normal writes',async t=>{
 const {pg,db,compact}=await fixture(t);await catalog(db);await compact();
 await pg.query("UPDATE findi.users SET name='Admin desde SQL' WHERE id='admin'");
 assert.equal((await db.collection('usuarios').doc('admin').get()).data().nombre,'Admin desde SQL');
 assert.deepEqual((await db.collection('usuarios').where('telefono','==',null).get()).docs.map(doc=>doc.id),['admin']);
 assert.deepEqual((await db.collection('real_productosFerreteria').where('precio','<',6000).get()).docs.map(doc=>doc.id),['offer']);
 await db.collection('usuarios').doc('admin').update({nombre:'Admin nuevo',professionalTools:{version:2,clients:[]},unknown:{keep:[true]}});
 const user=(await db.collection('usuarios').doc('admin').get()).data();assert.equal(user.nombre,'Admin nuevo');assert.deepEqual(user.professionalTools,{version:2,clients:[]});assert.deepEqual(user.unknown,{keep:[true]});assert.equal(user.creadoEn,'2026-10-01T12:00:00Z');
 const ref=db.collection('productosMaestro').doc('product'),product=(await ref.get()).data();
 await ref.update({imagenPrincipalUrl:product.imagenExternaUrl,galeriaJson:[product.imagenExternaUrl],caracteristicasDestacadas:['Nueva ficha']});
 assert.equal((await ref.get()).data().imagenPrincipalUrl,product.imagenExternaUrl);assert.deepEqual((await pg.query("SELECT features FROM findi.products WHERE id='product'")).rows[0].features,['Nueva ficha']);
 assert.equal((await pg.query("SELECT count(*)::int n FROM findi.media_assets WHERE product_id='product' AND is_primary")).rows[0].n,1);
 await pg.query("UPDATE findi.store_products SET price=7000,stock=9 WHERE id='offer'");const offer=(await db.collection('real_productosFerreteria').doc('offer').get()).data();assert.equal(offer.precio,7000);assert.equal(offer.stock,9);
 assert.equal((await pg.query(`SELECT (${compactDocumentSql('offers','o')})->'precio' AS price FROM findi.store_products o WHERE id='offer'`)).rows[0].price,7000);
 const batch=db.batch();batch.update(db.collection('usuarios').doc('admin'),{nombre:'Debe revertir'});batch.update(db.collection('real_productosFerreteria').doc('offer'),{precio:-1});await assert.rejects(batch.commit());assert.equal((await db.collection('usuarios').doc('admin').get()).data().nombre,'Admin nuevo');
 const project=db.collection('real_proyectos').doc('project');await project.update({name:'Obra actualizada'});
 const frozen=(await project.get()).data().pricingOffers;assert.equal(frozen[0].price,5490.5);
 await db.collection('productosMaestro').doc('other-product').set({...product,nombre:'Otra pintura',modelo:''});
 await assert.rejects(project.update({items:[{productName:'Otra pintura',productoMaestroId:'other-product',storeId:'store',productoFerreteriaId:'offer',quantity:1}]}),/QUOTATION_OFFER_IDENTITY_MISMATCH/);
 assert.equal((await project.get()).data().items[0].productoMaestroId,'product');
});
test('compact readiness does not accept an incomplete baseline',async t=>{
 const {pg,compact}=await fixture(t);await pg.query("UPDATE findi.database_migration_state SET status='verified'");await compact();
 const db=new PostgresDatabase({connect:async()=>({query:pg.query.bind(pg),release(){}})});
 await assert.rejects(db.collection('usuarios').get(),/SQL_BASELINE_NOT_READY/);
 assert.equal((await pg.query("SELECT status FROM findi.app_state WHERE id='baseline'")).rows[0].status,'building');
});

test('legacy transaction guard rejects paused writes before callbacks and keeps rollback connections usable',async t=>{
 const {pg,db}=await fixture(t);
 const ref=db.collection('usuarios').doc('paused-user');
 let invoked=false;
 await pg.query("UPDATE findi.database_migration_state SET manifest=jsonb_build_object('writesPaused',true)");
 await assert.rejects(db.runTransaction(async tx=>{invoked=true;tx.set(ref,{rol:'maestro',nombre:'Bloqueado',correo:'paused@example.test',estadoCuenta:'activo'});}),/DATABASE_WRITES_PAUSED/);
 assert.equal(invoked,false);assert.equal((await ref.get()).exists,false);
 const batch=db.batch();batch.set(ref,{rol:'maestro',nombre:'Bloqueado',correo:'paused@example.test',estadoCuenta:'activo'});
 await assert.rejects(batch.commit(),/DATABASE_WRITES_PAUSED/);assert.equal((await ref.get()).exists,false);
 await pg.query("UPDATE findi.database_migration_state SET manifest=jsonb_build_object('writesPaused',false)");
 await ref.set({rol:'maestro',nombre:'Permitido',correo:'paused@example.test',estadoCuenta:'activo'});
 assert.equal((await ref.get()).data().nombre,'Permitido');
 await db.runTransaction(async tx=>{const value=await tx.get(ref);assert.equal(value.data().nombre,'Permitido');tx.update(ref,{nombre:'Transacción posterior'});});
 assert.equal((await ref.get()).data().nombre,'Transacción posterior');
});
