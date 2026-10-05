import test from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, db } from '../lib/lib/firebase.js';
import { requireAuth } from '../lib/lib/auth.js';
async function request(t, profile) {
  t.mock.method(adminAuth,'verifyIdToken',async (_token,revoked)=>{assert.equal(revoked,true);return {uid:'fixture',email:'account@example.test'};});
  t.mock.method(db,'collection',()=>({doc:()=>({get:async()=>({exists:true,data:()=>profile})})}));
  const result={status:200,next:false};
  const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  await requireAuth({header:()=> 'Bearer token',originalUrl:'/api/auth/me'},res,()=>{result.next=true;});
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
