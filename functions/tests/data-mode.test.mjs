import test from 'node:test';
import assert from 'node:assert/strict';
import { dataMode, dataModeMiddleware } from '../lib/lib/data-mode.js';
import { COLLECTIONS } from '../lib/lib/collections.js';
import { db, adminAuth } from '../lib/lib/firebase.js';
import { rows, createRow, row } from '../lib/repositories/firestore.repository.js';
import { authUserResponse } from '../lib/services/user.service.js';
import { requireAuth } from '../lib/lib/auth.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
function response() { return { statusCode:200, headers:{}, setHeader(name,value){this.headers[name.toLowerCase()]=value;return this;},set(name,value){return this.setHeader(name,value);},vary(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;} }; }

test('business writes use real collections and the catalog stays shared', async t => {
  const fixture = firestoreFixture(t, {usuarios:{admin:{rol:'admin'},user:{rol:'maestro',dataMode:'real'}},productosMaestro:{cement:{nombre:'Cemento'}}});
  assert.equal(dataMode(), 'real');
  assert.equal(COLLECTIONS.stores, 'real_ferreterias');
  assert.equal(COLLECTIONS.projects, 'real_proyectos');
  assert.equal(COLLECTIONS.publicCache, 'real_cachePublico');
  assert.equal(COLLECTIONS.masterProducts, 'productosMaestro');
  await createRow(COLLECTIONS.stores, {nombreComercial:'Store'}, 'store');
  assert.equal(fixture.rows('ferreterias')[0].id, 'store');
  assert.equal((await rows(COLLECTIONS.masterProducts)).length, 1);
  assert.equal((await authUserResponse('admin')).rol, 'admin');
});
test('alternate environments are rejected even with administrator credentials', async t => {
  t.mock.method(adminAuth, 'verifyIdToken', async () => { throw new Error('Must not consult authentication for an invalid environment'); });
  for (const token of [undefined, 'Bearer admin-token']) {
    const res = response();
    dataModeMiddleware({header:name=>name==='X-Data-Mode'?'retired':token},res,()=>{throw new Error('Unexpected access');});
    assert.equal(res.statusCode,400);
    assert.equal(res.body.error.code,'DATA_MODE_INVALID');
  }
});
test('public calls use real data and authenticated responses cannot become publicly cacheable', () => {
  const publicResponse = response();
  let called = false;
  dataModeMiddleware({header:()=>undefined},publicResponse,()=>{called=true;});
  assert.equal(called,true);
  assert.equal(publicResponse.headers['x-data-mode'],'real');
  const privateResponse = response();
  dataModeMiddleware({header:name=>name==='Authorization'?'Bearer token':undefined},privateResponse,()=>privateResponse.set('Cache-Control','public,max-age=999'));
  assert.equal(privateResponse.headers['cache-control'],'private, no-store');
});
test('obsolete account environments are refused while the preserved administrator remains accessible', async t => {
  firestoreFixture(t,{usuarios:{user:{rol:'maestro',dataMode:'retired'},admin:{rol:'admin'}}});
  let uid='user'; t.mock.method(adminAuth,'verifyIdToken',async()=>({uid}));
  const req={header:()=> 'Bearer token',originalUrl:'/api/auth/me'};
  const res=response(); await requireAuth(req,res,()=>{throw new Error('Unexpected access');});
  assert.equal(res.body.error.code,'AUTH_DATA_MODE_MISMATCH');
  assert.equal(await row(COLLECTIONS.users,'user'),null);
  uid='admin'; let called=false;await requireAuth(req,response(),()=>{called=true;});assert.equal(called,true);
});
test('offers require a valid current commercial agreement', async t => {
  const {buildSearchRows}=await import('../lib/services/catalog-search.service.js');
  const {CURRENT_STORE_AGREEMENT_VERSION}=await import('../lib/lib/legal.js');
  const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
  firestoreFixture(t,{usuarios:{owner:{rol:'ferreteria',dataMode:'real',estadoCuenta:'activo'}},ferreterias:{store:{usuarioDuenoId:'owner',estado:'activo',nombreComercial:'Store'}},productosMaestro:{cement:{nombre:'Cemento',estado:'activo'}},productosFerreteria:{offer:{ferreteriaId:'store',productoMaestroId:'cement',precio:1000,stock:10,activo:true,publicado:true}}});
  assert.equal((await buildSearchRows()).length,0);
  await db.collection(COLLECTIONS.stores).doc('store').update({contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()});
  assert.equal((await buildSearchRows()).length,1);
});
test('new registrations and legal records use the real collections', async t => {
  const {authRouter}=await import('../lib/routes/auth.routes.js');
  const fixture=firestoreFixture(t);
  t.mock.method(adminAuth,'getUser',async()=>({email:'new@example.test'}));
  const register=authRouter.stack.find(layer=>layer.route?.path==='/auth/register').route.stack.at(-1).handle;
  const res=response();
  await register({authUserId:'new',body:{rol:'ferreteria',nombre:'New Store',nombreComercial:'New Store',termsAccepted:true,privacyAcknowledged:true,ageConfirmed:true,latitud:-33,longitud:-70}},res);
  assert.equal(res.statusCode,201);assert.equal(fixture.get('usuarios','new').dataMode,'real');
  assert.equal(fixture.rows('ferreterias').length,1);assert.equal(fixture.rows('registrosConsentimiento').length,4);
});
