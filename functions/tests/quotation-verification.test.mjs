import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationSnapshot,storeVerificationView,normalizeVerificationCode} from '../lib/services/quotation-verification.service.js';
import {storeQuotationsRouter} from '../lib/routes/store-quotations.routes.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const code='FND-AAAA-BBBB-CCCC-DDDD';
const project={id:'quote',ownerId:'master',description:'Private client details',address:'Private address',items:[{productName:'Cemento',quantity:2},{productName:'Clavos',quantity:3},{productName:'Inventado',quantity:1}],pricingOffers:[{productName:'Cemento',productoMaestroId:'cement',productoFerreteriaId:'offer-a',storeId:'a',storeName:'Local A',price:1000,stock:10},{productName:'Clavos',productoMaestroId:'nails',productoFerreteriaId:'offer-b',storeId:'b',storeName:'Local B',price:500,stock:10}],pricesCapturedAt:'2026-09-01T00:00:00Z',validUntil:'2026-09-11T00:00:00Z'};
const snapshot=()=>verificationSnapshot(project,code,'2026-10-09T12:00:00Z');
test('verification contains only server-priced products and each store sees only its own lines',()=>{
 const record=snapshot();assert.equal(record.lines.length,2);
 const view=storeVerificationView(record,'a');assert.equal(view.lines.length,1);assert.equal(view.lines[0].productName,'Cemento');assert.equal(view.total,2000);
 assert.equal(view.withinRecommendedPeriod,false);assert.equal(storeVerificationView(record,'other'),null);
 assert.ok(!JSON.stringify(view).includes('Private'));assert.equal(view.ownerId,undefined);assert.equal(view.quotationReference,undefined);
 assert.equal(normalizeVerificationCode('fnd aaaabbbbccccdddd'),code);assert.equal(normalizeVerificationCode('anything'),null);
});
const handler=storeQuotationsRouter.stack[0].route.stack.at(-1).handle;
const response=()=>({statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('lookup enforces store ownership and does not reveal unrelated or invalid quotations',async t=>{
 firestoreFixture(t,{ferreterias:{a:{usuarioDuenoId:'owner-a'},b:{usuarioDuenoId:'owner-b'},c:{usuarioDuenoId:'owner-c'}},cotizacionesVerificables:{[code]:snapshot()}});
 const req={authRole:'ferreteria',authUserId:'owner-a',params:{storeId:'a',code}};
 const result=response();await handler(req,result);assert.equal(result.statusCode,200);assert.equal(result.body.data.total,2000);assert.equal(result.headers['Cache-Control'],'private, no-store');
 const denied=response();await handler({...req,params:{storeId:'b',code}},denied);assert.equal(denied.statusCode,403);
 const unrelated=response();await handler({...req,authUserId:'owner-c',params:{storeId:'c',code}},unrelated);assert.equal(unrelated.statusCode,404);
 const missing=response();await handler({...req,params:{storeId:'a',code:'FND-1111-2222-3333-4444'}},missing);assert.equal(missing.statusCode,404);
});
