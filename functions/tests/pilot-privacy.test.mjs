import test from 'node:test';
import assert from 'node:assert/strict';
import { authRouter } from '../lib/routes/auth.routes.js';
import { privacyRouter } from '../lib/routes/privacy.routes.js';
import { projectsRouter } from '../lib/routes/projects.routes.js';
import { storeCatalogRouter } from '../lib/routes/store-catalog.routes.js';
import { requireAuth } from '../lib/lib/auth.js';
import { adminAuth } from '../lib/lib/firebase.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/lib/legal.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
function handler(router, path, method) { return router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle; }
const response = () => ({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const legal = {termsAccepted:true,privacyAcknowledged:true,ageConfirmed:true,termsVersion:CURRENT_TERMS_VERSION,privacyVersion:CURRENT_PRIVACY_VERSION};

for (const [router,path] of [[authRouter,'/auth/register'],[privacyRouter,'/privacy/consents/current']]) {
  test(`${path} rejects stale documents without recording consent`, async t => {
    const fixture=firestoreFixture(t);
    for (const key of ['termsVersion','privacyVersion']) for (const version of [undefined,'old']) {
      const res=response();
      await handler(router,path,'post')({authUserId:'user',body:{...legal,rol:'maestro',[key]:version}},res);
      assert.equal(res.statusCode,409);
      assert.equal(fixture.rows('usuarios').length,0);
      assert.equal(fixture.rows('registrosConsentimiento').length,0);
    }
  });
}
test('an old acknowledgement requires new authorization and still permits access to the privacy center',async t=>{
  firestoreFixture(t,{usuarios:{user:{rol:'maestro',estadoCuenta:'activo',terminosVersion:'1.0',privacidadVersion:'1.1',mayoriaEdadDeclarada:true}}});
  t.mock.method(adminAuth,'verifyIdToken',async()=>({uid:'user'}));
  for (const path of ['/api/maestros/user/proyectos','/api/privacy/overview']) {
    let next=false; const res=response();
    await requireAuth({originalUrl:path,header:()=> 'Bearer token'},res,()=>next=true);
    assert.equal(next,path.includes('/privacy/'));
    if (!next) assert.equal(res.statusCode,428);
  }
});
test('a store cannot read or write another store catalog',async t=>{
  const fixture=firestoreFixture(t,{ferreterias:{other:{usuarioDuenoId:'another'}}});
  for (const method of ['get','post']) {
    const res=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo',method)({authUserId:'owner',authRole:'ferreteria',params:{storeId:'other'},body:{}},res);
    assert.equal(res.statusCode,403);
    assert.equal(fixture.rows('productosFerreteria').length,0);
  }
});
test('a maestro cannot read another account quotation',async t=>{
  firestoreFixture(t,{proyectos:{project:{ownerId:'other'}}});
  const res=response();await handler(projectsRouter,'/maestros/:ownerId/proyectos/:projectId','get')({authUserId:'owner',authRole:'maestro',params:{ownerId:'other',projectId:'project'}},res);
  assert.equal(res.statusCode,403);
});
