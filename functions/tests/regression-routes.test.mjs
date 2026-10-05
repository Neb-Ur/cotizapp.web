import test from 'node:test';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/lib/legal.js';
import assert from 'node:assert/strict';
import { adminAuth } from '../lib/lib/firebase.js';
import { authRouter } from '../lib/routes/auth.routes.js';
import { privacyRouter } from '../lib/routes/privacy.routes.js';
import { intellectualPropertyRouter } from '../lib/routes/intellectual-property.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
function handler(router, path, method) { return router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle; }
function response() { return { statusCode:200, status(code) {this.statusCode=code; return this;}, json(value) {this.body=value;return this;} }; }
test('existing profile cannot be overwritten through registration', async t => {
 const profile = { rol:'ferreteria', estadoCuenta:'bloqueado', nombre:'Original' };
 const fixture = firestoreFixture(t, {usuarios:{user:profile}});
 t.mock.method(adminAuth, 'getUser', async () => ({email:'user@example.test'}));
 const res = response();
 await handler(authRouter,'/auth/register','post')({authUserId:'user',body:{rol:'maestro',nombre:'Changed',termsAccepted:true,privacyAcknowledged:true,termsVersion:CURRENT_TERMS_VERSION,privacyVersion:CURRENT_PRIVACY_VERSION,ageConfirmed:true}},res);
 assert.equal(res.statusCode,409);assert.deepEqual(fixture.get('usuarios','user'),profile);
});
test('invalid store coordinates do not partially update the user profile', async t => {
 const fixture = firestoreFixture(t, {usuarios:{user:{nombre:'Original'}},ferreterias:{store:{usuarioDuenoId:'user',latitud:-33,longitud:-70}}});
 const res = response();
 await handler(authRouter,'/auth/me','patch')({authUserId:'user',body:{nombre:'Changed',latitud:100,longitud:0}},res);
 assert.equal(res.statusCode,400); assert.equal(fixture.get('usuarios','user').nombre,'Original');
 assert.equal(fixture.get('ferreterias','store').latitud,-33);
});
test('account deletion rejects an old session before reading or deleting any data', async t => {
 const fixture = firestoreFixture(t, {usuarios:{user:{nombre:'Original'}}});
 const auth = t.mock.method(adminAuth,'getUser',async()=>{throw new Error('Unexpected auth read');});
 const res = response();
 await handler(privacyRouter,'/privacy/account','delete')({authUserId:'user',authRole:'maestro',authTime:Math.floor(Date.now()/1000)-600,body:{}},res);
 assert.equal(res.statusCode,401); assert.equal(res.body.error.code,'AUTH_RECENT_LOGIN_REQUIRED');
 assert.equal(auth.mock.callCount(),0); assert.ok(fixture.get('usuarios','user'));
});
for (const initial of [{activo:true,publicado:true},{activo:false,publicado:false}]) {
 test(`moderation restores the original offer state: ${JSON.stringify(initial)}`,async t=>{
  const fixture = firestoreFixture(t,{denunciasPropiedadIntelectual:{report:{targetType:'store_offer',targetId:'offer'}},productosFerreteria:{offer:initial}});
  const resolve = handler(intellectualPropertyRouter,'/admin/ip-reports/:id','patch');
  const request = status => ({params:{id:'report'},authUserId:'admin',body:{status,resolution:'Revisión documentada',publicStatusMessage:'Decisión documentada'}});
  await resolve(request('retiro_preventivo'),response());
  assert.equal(fixture.get('productosFerreteria','offer').activo,false);
  await resolve(request('retiro_definitivo'),response());
  await resolve(request('repuesto'),response());
  const restored=fixture.get('productosFerreteria','offer');
  assert.equal(restored.activo,initial.activo);assert.equal(restored.publicado,initial.publicado);
 });
}
