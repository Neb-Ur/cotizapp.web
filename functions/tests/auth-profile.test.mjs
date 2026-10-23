import test from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, db } from '../lib/lib/firebase.js';
import { requireAuth } from '../lib/lib/auth.js';
import { canAccessOwner, requireStoreWriteAccess, storeOwnedBy } from '../lib/lib/ownership.js';
async function request(t, profile, originalUrl = '/api/auth/me') {
  t.mock.method(adminAuth,'verifyIdToken',async (_token,revoked)=>{assert.equal(revoked,true);return {uid:'fixture',email:'account@example.test'};});
  t.mock.method(db,'collection',()=>({doc:()=>({get:async()=>({exists:profile !== null,data:()=>profile})})}));
  const result={status:200,next:false};
  const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  await requireAuth({header:()=> 'Bearer token',originalUrl},res,()=>{result.next=true;});
  return result;
}
test('active administrator can access the account endpoint without environment metadata',async t=>{
  assert.equal((await request(t,{rol:'admin',estadoCuenta:'activo'})).next,true);
});
test('blocked administrator cannot access the account endpoint',async t=>{
  const result=await request(t,{rol:'admin',estadoCuenta:'bloqueado'});
  assert.equal(result.next,false);assert.equal(result.body.error.code,'AUTH_ACCOUNT_BLOCKED');
});
test('real business accounts can access the account endpoint',async t=>{
  assert.equal((await request(t,{rol:'maestro',dataMode:'real',estadoCuenta:'activo'})).next,true);
});
test('query strings cannot bypass privacy processing blocks',async t=>{
  const result=await request(t,{rol:'maestro',dataMode:'real',tratamientoBloqueado:true},'/api/projects?return=/privacy/');
  assert.equal(result.next,false);
  assert.equal(result.body.error.code,'PRIVACY_PROCESSING_BLOCKED');
});
test('query strings cannot bypass required legal acceptance',async t=>{
  const result=await request(t,{rol:'maestro',dataMode:'real'},'/api/projects?return=/privacy/');
  assert.equal(result.next,false);
  assert.equal(result.body.error.code,'LEGAL_ACCEPTANCE_REQUIRED');
});
test('nested path segments do not grant privacy exemptions',async t=>{
  for(const path of ['/api/projects/privacy/items','/api/projects/auth/me']) {
    const result=await request(t,{rol:'maestro',dataMode:'real',tratamientoBloqueado:true},path);
    assert.equal(result.next,false);
    assert.equal(result.body.error.code,'PRIVACY_PROCESSING_BLOCKED');
  }
});
test('privacy and account endpoints remain accessible with query strings',async t=>{
  const profile={rol:'maestro',dataMode:'real',tratamientoBloqueado:true};
  assert.equal((await request(t,profile,'/api/privacy/requests?limit=10')).next,true);
  assert.equal((await request(t,profile,'/api/auth/me?refresh=true')).next,true);
});
test('a valid Firebase token without a profile cannot access application routes',async t=>{
  const result=await request(t,null,'/api/projects');
  assert.equal(result.next,false);
  assert.equal(result.body.error.code,'AUTH_USER_NOT_FOUND');
});
test('users without profiles retain registration and session recovery access',async t=>{
  for(const path of ['/api/auth/register','/api/auth/session','/api/auth/me','/api/auth/logout','/auth/register','/api/auth/register/','/API/AUTH/REGISTER/']) {
    assert.equal((await request(t,null,path)).next,true);
  }
});
test('profiles with unknown roles cannot access authenticated application routes',async t=>{
  const result=await request(t,{rol:'unknown',dataMode:'real'},'/api/auth/me');
  assert.equal(result.next,false);
  assert.equal(result.body.error.code,'AUTH_FORBIDDEN');
});
test('owner access fails closed without an authenticated identity or owner',()=>{
  assert.equal(canAccessOwner({},undefined),false);
  assert.equal(canAccessOwner({authUserId:''},''),false);
  assert.equal(canAccessOwner({authRole:'admin'},'owner'),false);
  assert.equal(canAccessOwner({authUserId:'owner'},'owner'),true);
  assert.equal(canAccessOwner({authUserId:'other'},'owner'),false);
  assert.equal(canAccessOwner({authUserId:'admin',authRole:'admin'},'owner'),true);
});
test('store ownership rejects missing identifiers without querying storage',async()=>{
  assert.equal(await storeOwnedBy('store',undefined),false);
  assert.equal(await storeOwnedBy('', 'owner'),false);
});
test('an admin role alone cannot authorize store writes',async()=>{
  const result={status:200};
  const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  assert.equal(await requireStoreWriteAccess({authRole:'admin'},res,'store'),false);
  assert.equal(result.status,403);
  assert.equal(await requireStoreWriteAccess({authUserId:'admin',authRole:'admin'},res,'store'),true);
});
