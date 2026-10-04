import test from 'node:test';
import assert from 'node:assert/strict';
import { dataMode, defaultDataMode, withDataMode, dataModeMiddleware } from '../lib/lib/data-mode.js';
import { COLLECTIONS } from '../lib/lib/collections.js';
import { db, adminAuth } from '../lib/lib/firebase.js';
import { rows, createRow, row } from '../lib/repositories/firestore.repository.js';
import { authUserResponse } from '../lib/services/user.service.js';
import { requireAuth } from '../lib/lib/auth.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
function env(t, value) {
 const previous=process.env.DEMO;process.env.DEMO=value;
 t.after(()=>{if(previous===undefined)delete process.env.DEMO;else process.env.DEMO=previous;});
}
function response(){return {statusCode:200,headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=value;return this;},set(name,value){this.setHeader(name,value);return this;},vary(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('DEMO accepts true/false, with real as the safe default',t=>{
 env(t,'false');assert.equal(defaultDataMode(),'real');process.env.DEMO='true';assert.equal(defaultDataMode(),'demo');
 process.env.DEMO='yes';assert.throws(defaultDataMode,/true o false/);
});
test('concurrent requests retain separate collections throughout asynchronous work',async t=>{
 env(t,'false');
 const [demo,real]=await Promise.all([
  withDataMode('demo',async()=>{await new Promise(resolve=>setTimeout(resolve,8));return [dataMode(),COLLECTIONS.stores,COLLECTIONS.projects,COLLECTIONS.publicCache];}),
  withDataMode('real',async()=>{await new Promise(resolve=>setTimeout(resolve,2));return [dataMode(),COLLECTIONS.stores,COLLECTIONS.projects,COLLECTIONS.publicCache];})
 ]);
 assert.deepEqual(demo,['demo','ferreterias','proyectos','cachePublico']);
 assert.deepEqual(real,['real','real_ferreterias','real_proyectos','real_cachePublico']);
 assert.equal(COLLECTIONS.masterProducts,'productosMaestro');assert.equal(COLLECTIONS.categories,'categorias');
});
test('real starts with no maestros/stores, retains catalog and cross admin, and writes only into real',async t=>{
 env(t,'false');
 const fixture=firestoreFixture(t, {usuarios:{admin:{rol:'admin',nombre:'Admin'},maestro:{rol:'maestro',nombre:'Demo',dataMode:'demo'}},productosMaestro:{cement:{nombre:'Cemento'}}});
 // Seed physical legacy demo business collections independently of the active realm.
 await db.collection('ferreterias').doc('demo-store').set({usuarioDuenoId:'maestro'});
 await db.collection('proyectos').doc('demo-project').set({ownerId:'maestro'});
 assert.deepEqual((await rows(COLLECTIONS.users)).map(user=>user.id),['admin']);
 assert.equal((await rows(COLLECTIONS.stores)).length,0);assert.equal((await rows(COLLECTIONS.projects)).length,0);
 assert.equal((await rows(COLLECTIONS.masterProducts)).length,1);
 assert.equal((await authUserResponse('admin')).rol,'admin');assert.equal(await row(COLLECTIONS.users,'maestro'),null);
 await createRow(COLLECTIONS.stores,{nombreComercial:'Real'},'real-store');
 await withDataMode('demo',async()=>{
  assert.equal((await rows(COLLECTIONS.stores)).length,1);
  assert.equal((await rows(COLLECTIONS.stores))[0].id,'demo-store');
  assert.equal((await authUserResponse('admin')).rol,'admin');
  assert.equal((await rows(COLLECTIONS.users)).length,2);
 });
 assert.equal(fixture.rows('ferreterias')[0].id,'real-store');
});
test('ordinary users and anonymous callers cannot override the server environment',async t=>{
 env(t,'false');firestoreFixture(t,{usuarios:{user:{rol:'maestro',dataMode:'real'}}});
 t.mock.method(adminAuth,'verifyIdToken',async()=>({uid:'user'}));
 const res=response();let called=false;
 await dataModeMiddleware({header:name=>name==='X-Data-Mode'?'demo':'Bearer token'},res,()=>{called=true;});
 assert.equal(res.statusCode,403);assert.equal(called,false);
 const anonymous=response();await dataModeMiddleware({header:name=>name==='X-Data-Mode'?'real':undefined},anonymous,()=>{throw new Error('Unexpected access');});
 assert.equal(anonymous.statusCode,403);
});
test('active cross admin can override mode and the response cannot become public cacheable',async t=>{
 env(t,'false');firestoreFixture(t,{usuarios:{admin:{rol:'admin',estadoCuenta:'activo'}}});
 t.mock.method(adminAuth,'verifyIdToken',async(_,revoked)=>{assert.equal(revoked,true);return {uid:'admin'};});
 const res=response();let selected;
 await dataModeMiddleware({header:name=>name==='X-Data-Mode'?'demo':'Bearer token'},res,()=>{selected=dataMode();res.set('Cache-Control','public,max-age=999');});
 assert.equal(selected,'demo');assert.equal(res.headers['cache-control'],'private, no-store');assert.equal(res.headers['x-robots-tag'],'noindex, nofollow');
});
test('account from demo is refused in real, while admin remains cross',async t=>{
 env(t,'false');firestoreFixture(t,{usuarios:{user:{rol:'maestro',dataMode:'demo'},admin:{rol:'admin'}}});
 let uid='user';t.mock.method(adminAuth,'verifyIdToken',async()=>({uid}));
 const req={header:()=> 'Bearer token',originalUrl:'/api/auth/me'};
 const res=response();await requireAuth(req,res,()=>{throw new Error('Unexpected access');});
 assert.equal(res.body.error.code,'AUTH_DATA_MODE_MISMATCH');
 uid='admin';let called=false;await requireAuth(req,response(),()=>{called=true;});assert.equal(called,true);
});
test('legacy generic catalog projection does not publish invented demo brands in real',async t=>{
 env(t,'false');firestoreFixture(t,{productosMaestro:{cement:{nombre:'Cemento',marca:'Demo brand',descripcionCorta:'Cemento genérico',descripcionLarga:'Ficha demostrativa de Cemento. Datos generados para pruebas.',seedTag:'pilot-catalog-auth-v3-2026-09-30'}}});
 const real=(await rows(COLLECTIONS.masterProducts))[0];assert.equal(real.marca,'Genérico');assert.equal(real.descripcionLarga,'Cemento genérico');
 const demo=await withDataMode('demo',()=>row(COLLECTIONS.masterProducts,'cement'));assert.equal(demo.marca,'Demo brand');
});
test('demo offers remain available without a real commercial agreement; real offers still require it',async t=>{
 const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');env(t,'false');
 withDataMode('demo',()=>firestoreFixture(t,{usuarios:{owner:{rol:'ferreteria',dataMode:'demo',estadoCuenta:'activo'}},ferreterias:{store:{usuarioDuenoId:'owner',estado:'activo',nombreComercial:'Demo'}},productosMaestro:{cement:{nombre:'Cemento',estado:'activo'}},productosFerreteria:{offer:{ferreteriaId:'store',productoMaestroId:'cement',precio:1000,stock:10,activo:true,publicado:true}}}));
 assert.equal((await withDataMode('demo',buildSearchRows)).length,1);
 assert.equal((await withDataMode('real',buildSearchRows)).length,0);
 await db.collection(COLLECTIONS.users).doc('real-owner').set({rol:'ferreteria',dataMode:'real',estadoCuenta:'activo'});
 await db.collection(COLLECTIONS.stores).doc('store').set({usuarioDuenoId:'real-owner',estado:'activo'});
 await db.collection(COLLECTIONS.storeProducts).doc('offer').set({ferreteriaId:'store',productoMaestroId:'cement',precio:1000,stock:10});
 assert.equal((await buildSearchRows()).length,0);
});
test('public memory cache never reuses a snapshot from another realm, even with equal versions',async t=>{
 const {getPublicCatalogSnapshot}=await import('../lib/lib/public-catalog-cache.js');
 const {CURRENT_STORE_AGREEMENT_VERSION}=await import('../lib/lib/legal.js');
 const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
 env(t,'false');firestoreFixture(t);
 for(const mode of ['demo','real']) await withDataMode(mode,async()=>{
  const cache=db.collection(COLLECTIONS.publicCache);
  await cache.doc('meta').set({dirty:false,version:'same-version',updatedAt:new Date().toISOString(),policy:`data-modes-v1:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']});
  await cache.doc('taxonomy').set({categories:[],subcategories:[],families:[]});
  await cache.doc('products').set({items:[{id:mode,nombre:mode}]});
  await cache.doc('offers').set({items:mode==='demo'?[{productoMaestroId:'demo',price:1000}]:[]});
 });
 const demo=await withDataMode('demo',getPublicCatalogSnapshot);const real=await withDataMode('real',getPublicCatalogSnapshot);
 assert.equal(demo.products[0].id,'demo');assert.equal(real.products[0].id,'real');assert.equal(real.searchRows.length,0);
 assert.equal((await withDataMode('demo',getPublicCatalogSnapshot)).products[0].id,'demo');
});
for(const mode of ['real','demo']) test(`new store registrations and their legal records stay in ${mode}`,async t=>{
 env(t,mode==='demo'?'true':'false');
 const {authRouter}=await import('../lib/routes/auth.routes.js');
 const fixture=firestoreFixture(t);
 t.mock.method(adminAuth,'getUser',async()=>({email:'new@example.test'}));
 const register=authRouter.stack.find(layer=>layer.route?.path==='/auth/register').route.stack.at(-1).handle;
 const res=response();
 await register({authUserId:'new',body:{rol:'ferreteria',nombre:'New Store',nombreComercial:'New Store',termsAccepted:true,privacyAcknowledged:true,ageConfirmed:true,latitud:-33,longitud:-70}},res);
 assert.equal(res.statusCode,201);assert.equal(fixture.get('usuarios','new').dataMode,mode);
 assert.equal(fixture.rows('ferreterias').length,1);assert.equal(fixture.rows('registrosConsentimiento').length,4);
 const other=mode==='real'?'demo':'real';
 await withDataMode(other,async()=>{assert.equal((await rows(COLLECTIONS.stores)).length,0);assert.equal(await authUserResponse('new'),null);assert.equal((await rows(COLLECTIONS.consentRecords)).length,0);});
});
