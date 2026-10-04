import test from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth, db } from '../lib/lib/firebase.js';
import { requireAuth } from '../lib/lib/auth.js';
async function request(t, profile) {
 t.mock.method(adminAuth,'verifyIdToken',async (_token,revoked)=>{ assert.equal(revoked,true); return {uid:'fixture',email:'admin@demo.cl'}; });
 t.mock.method(db,'collection',()=>({ doc:()=>({get:async()=>({exists:true,data:()=>({dataMode:'real',...profile})})}) }));
 const result={status:200,next:false};
 const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
 await requireAuth({header:()=> 'Bearer token',originalUrl:'/api/auth/me'},res,()=>{result.next=true;});
 return result;
}
test('production denies seeded non-admin demo accounts even with a valid token',async t=>{
 const result=await request(t,{seedTag:'pilot-catalog-auth-v3-2026-09-30',rol:'ferreteria'});
 assert.equal(result.status,403);assert.equal(result.next,false);assert.equal(result.body.error.code,'AUTH_DEMO_ACCOUNT_DISABLED');
});
test('a normal account is not blocked merely for using the same email domain',async t=>{
 const result=await request(t,{rol:'maestro'});assert.equal(result.next,true);
});
test('local emulators retain access for explicitly seeded QA fixtures',async t=>{
 const previous=process.env.FUNCTIONS_EMULATOR;process.env.FUNCTIONS_EMULATOR='true';
 t.after(()=>{if(previous===undefined)delete process.env.FUNCTIONS_EMULATOR;else process.env.FUNCTIONS_EMULATOR=previous;});
 const result=await request(t,{seedTag:'pilot-catalog-auth-v3-2026-09-30',rol:'admin'});assert.equal(result.next,true);
});

test('an authenticated active administrator remains cross even with legacy demo metadata',async t=>{
 const result=await request(t,{seedTag:'pilot-catalog-auth-v3-2026-09-30',rol:'admin',dataMode:'demo'});assert.equal(result.next,true);
});
