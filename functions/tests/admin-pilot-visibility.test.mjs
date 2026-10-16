import test from 'node:test';
import assert from 'node:assert/strict';
import {authRouter} from '../lib/routes/auth.routes.js';
import {adminUsersRouter} from '../lib/routes/admin-users.routes.js';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {publicCatalogRouter} from '../lib/routes/public-catalog.routes.js';
import {searchRouter} from '../lib/routes/search.routes.js';
import {directoryStores,directoryStore} from '../lib/services/store-directory.service.js';
import {getPublicCatalogSnapshot} from '../lib/lib/public-catalog-cache.js';
import {invalidateStaticCatalog,getStaticCatalog,getProductSheet} from '../lib/lib/product-sheet-cache.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
import {adminAuth,db} from '../lib/lib/firebase.js';
import {COLLECTIONS} from '../lib/lib/collections.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(router,path,method='get')=>router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},set(){return this;},type(){return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;}});
test('admin explicitly creates and edits test stores, validates booleans and preserves the flag on other edits',async t=>{
 const f=firestoreFixture(t);let creates=0;t.mock.method(adminAuth,'createUser',async()=>({uid:'owner-'+(++creates)}));
 const body={rol:'ferreteria',tipoNegocio:'desarmaduria',password:'Test123!',nombre:'Contacto',correo:'test@example.test',ciudad:'Santiago',comuna:'Maipú',direccion:'Prueba',latitud:-33.5,longitud:-70.6,estadoCuenta:'activo'};
 const post=handler(adminUsersRouter,'/admin/usuarios','post');
 for(const value of ['true',1,null]){const res=response();await post({body:{...body,esPrueba:value}},res);assert.equal(res.statusCode,400);}
 assert.equal(creates,0);
 const pilot=response();await post({body:{...body,esPrueba:true}},pilot);assert.equal(pilot.statusCode,201);assert.equal(pilot.body.data.esPrueba,true);const storeId=pilot.body.data.ferreteriaId;assert.equal(f.get('ferreterias',storeId).esPrueba,true);
 const real=response();await post({body},real);assert.equal(real.body.data.esPrueba,false);
 const patch=handler(adminUsersRouter,'/admin/usuarios/:id','patch');const req=body=>({params:{id:'owner-1'},body});
 await patch(req({nombre:'Nuevo contacto'}),response());assert.equal(f.get('ferreterias',storeId).esPrueba,true);
 const invalid=response();await patch(req({esPrueba:'false',nombre:'No guardar'}),invalid);assert.equal(invalid.statusCode,400);assert.equal(f.get('usuarios','owner-1').nombre,'Nuevo contacto');
 const updated=response();await patch(req({esPrueba:false}),updated);assert.equal(updated.body.data.esPrueba,false);assert.equal(f.get('ferreterias',storeId).esPrueba,false);
});
test('switching pilot visibility filters directory, offers, static search, detail and sitemap while admin retains access',async t=>{
 const before=process.env.PILOT_STORES_ENABLED;
 const agreement={estado:'activo',contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()};
 firestoreFixture(t,{
  usuarios:{owner:{estadoCuenta:'activo'},pilotOwner:{estadoCuenta:'activo'}},
  ferreterias:{real:{...agreement,usuarioDuenoId:'owner',nombreComercial:'Real'},pilot:{...agreement,usuarioDuenoId:'pilotOwner',nombreComercial:'Prueba',esPrueba:true}},
  productosMaestro:{real:{nombre:'Pieza real',estado:'activo'},pilot:{nombre:'Pieza de prueba',estado:'activo',esPrueba:true}},
  productosFerreteria:{real:{ferreteriaId:'real',productoMaestroId:'real',precio:100,stock:1},pilotStore:{ferreteriaId:'pilot',productoMaestroId:'real',precio:80,stock:1},pilotProduct:{ferreteriaId:'real',productoMaestroId:'pilot',precio:50,stock:1},pilotOffer:{ferreteriaId:'real',productoMaestroId:'real',precio:60,stock:1,esPrueba:true}}
 });
 const collection=db.collection.bind(db);t.mock.method(db,'collection',name=>{const ref=collection(name);if(name===COLLECTIONS.publicCache){const where=ref.where.bind(ref);ref.where=(field,op,value)=>op==='<'?{limit:()=>({get:async()=>({docs:[]})})}:where(field,op,value);}return ref;});
 try{
  await invalidateStaticCatalog();
  for(const enabled of [true,false,true]){
   process.env.PILOT_STORES_ENABLED=String(enabled);
   const snapshot=await getPublicCatalogSnapshot();assert.equal(snapshot.products.length,enabled?2:1);assert.equal(snapshot.searchRows.length,enabled?4:1);
   assert.equal((await directoryStores()).length,enabled?2:1);assert.equal(!!await directoryStore('pilot'),enabled);
   assert.equal((await getStaticCatalog())[0].length,enabled?2:1);assert.equal(!!await getProductSheet('pieza de prueba',''),enabled);
   for(const path of ['/productos-maestro','/productos-maestro/paginado']){const res=response();await handler(masterProductsRouter,path)({query:{}},res);assert.equal((res.body.data.items||res.body.data).length,enabled?2:1);}
   const detail=response();await handler(masterProductsRouter,'/productos-maestro/:id')({params:{id:'pilot'}},detail);assert.equal(detail.statusCode,enabled?200:404);
   const search=response();await handler(searchRouter,'/busqueda')({query:{vista:'productos',query:'Pieza de prueba'}},search);assert.equal(search.body.data.total,enabled?1:0);
   const index=response();await handler(publicCatalogRouter,'/catalogo-busqueda')({query:{}},index);assert.equal(index.body.data.products.length,enabled?2:1);
   const sitemap=response();await handler(publicCatalogRouter,'/sitemap.xml')({},sitemap);assert.equal(sitemap.body.includes('/productos/pieza-de-prueba'),enabled);
   const admin=response();await handler(masterProductsRouter,'/admin/productos-maestro/paginado')({query:{},authRole:'admin'},admin);assert.equal(admin.body.data.total,2);
  }
 }finally{if(before===undefined)delete process.env.PILOT_STORES_ENABLED;else process.env.PILOT_STORES_ENABLED=before;}
});

test('owners cannot mark their own store as a pilot to bypass publication requirements',async t=>{
 const f=firestoreFixture(t,{usuarios:{owner:{rol:'ferreteria',nombre:'Dueño',correo:'local@example.test',estadoCuenta:'activo'}},ferreterias:{s:{usuarioDuenoId:'owner',nombreComercial:'Local real',esPrueba:false}}});
 const res=response();await handler(authRouter,'/auth/me','patch')({authUserId:'owner',body:{esPrueba:true,nombre:'Contacto actualizado'}},res);
 assert.equal(res.statusCode,200);assert.equal(f.get('ferreterias','s').esPrueba,false);
});
