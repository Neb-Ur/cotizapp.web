import test from 'node:test';
import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {projectsRouter} from '../lib/routes/projects.routes.js';
import {db} from '../lib/lib/firebase.js';
import {COLLECTIONS} from '../lib/lib/collections.js';
const handler=(method,path)=>projectsRouter.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('description persists through create, updates and item additions without affecting quotation ownership',async t=>{
 const fixture=firestoreFixture(t,{usuarios:{master:{rol:'maestro',estadoCuenta:'activo'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master'},body:{nombre:'Cocina',descripcion:'Reparar muebles',items:[]}};
 const created=response();await handler('post','/maestros/:ownerId/proyectos')(req,created);
 assert.equal(created.statusCode,201);assert.equal(created.body.data.description,'Reparar muebles');
 const id=created.body.data.id;
 const updated=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,params:{ownerId:'master',projectId:id},body:{nombre:'Cocina ajustada',descripcion:'Instalar muebles',items:[]}},updated);
 assert.equal(updated.body.data.description,'Instalar muebles');
 const legacy=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,params:{ownerId:'master',projectId:id},body:{nombre:'Cocina final',items:[]}},legacy);
 assert.equal(legacy.body.data.description,'Instalar muebles');
 assert.equal(fixture.rows('proyectos')[0].description,'Instalar muebles');
});
test('the ten-day period is advisory: editing an old quotation remains allowed',async t=>{
 firestoreFixture(t,{usuarios:{master:{rol:'maestro',estadoCuenta:'activo'}},proyectos:{quote:{ownerId:'master',name:'Obra',items:[],pricingOffers:[],pricesCapturedAt:'2020-01-01T00:00:00Z',validUntil:'2020-01-11T00:00:00Z',createdAt:'2020-01-01T00:00:00Z'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'},body:{nombre:'Obra',items:[]}};
 const refused=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')(req,refused);assert.equal(refused.statusCode,200);assert.equal(refused.body.data.validUntil,'2020-01-11T00:00:00Z');assert.ok(refused.body.data.verificationCode);
 const renewed=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,body:{...req.body,renovarPrecios:true}},renewed);assert.equal(renewed.statusCode,200);assert.equal(renewed.body.data.expired,false);
 assert.equal(Date.parse(renewed.body.data.validUntil)-Date.parse(renewed.body.data.pricesCapturedAt),10*86400000);
});
test('changing a quotation issues a new code while the earlier verification remains unchanged',async t=>{
 const fixture=firestoreFixture(t,{usuarios:{master:{rol:'maestro',estadoCuenta:'activo'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master'},body:{nombre:'Obra',items:[]}};
 const created=response();await handler('post','/maestros/:ownerId/proyectos')(req,created);
 const id=created.body.data.id,firstCode=created.body.data.verificationCode;
 assert.ok(firstCode);const first=fixture.get('cotizacionesVerificables',firstCode);
 const updated=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,params:{ownerId:'master',projectId:id},body:{...req.body,nombre:'Obra ajustada'}},updated);
 assert.equal(updated.statusCode,200);assert.notEqual(updated.body.data.verificationCode,firstCode);assert.deepEqual(fixture.get('cotizacionesVerificables',firstCode),first);
});
test('legacy quotation payloads with an embedded ID remain editable',async t=>{
 firestoreFixture(t,{usuarios:{master:{rol:'maestro',estadoCuenta:'activo'}},proyectos:{quote:{id:'quote',ownerId:'master',name:'Obra',items:[],pricingOffers:[],createdAt:'2026-10-09T00:00:00Z'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'},body:{nombre:'Obra actualizada',items:[]}};
 const result=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')(req,result);assert.equal(result.statusCode,200);assert.equal(result.body.data.name,'Obra actualizada');assert.ok(result.body.data.verificationCode);
});

test('empty quotations receive a persisted verification code at creation',async t=>{
 const fixture=firestoreFixture(t);
 const result=response();
 await handler('post','/maestros/:ownerId/proyectos')({authRole:'maestro',authUserId:'master',params:{ownerId:'master'},body:{nombre:'Nueva obra',items:[]}},result);
 assert.equal(result.statusCode,201);
 const {id,verificationCode}=result.body.data;
 assert.match(verificationCode,/^TRV-(?:[0-9A-F]{4}-){3}[0-9A-F]{4}$/);
 assert.equal(fixture.get('proyectos',id).verificationCode,verificationCode);
 assert.equal(fixture.get('cotizacionesVerificables',verificationCode).quotationReference,id);
});

test('legacy quotations get one code through the list used by detail and keep their saved validity',async t=>{
 const fixture=firestoreFixture(t,{proyectos:{quote:{ownerId:'master',name:'Obra antigua',items:[],pricingOffers:[],pricesCapturedAt:'2020-01-01T00:00:00Z',validUntil:'2020-01-11T00:00:00Z'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'}};
 const list=response();await handler('get','/maestros/:ownerId/proyectos')(req,list);
 const code=list.body.data[0].verificationCode;
 assert.ok(code);assert.equal(list.body.data[0].validUntil,'2020-01-11T00:00:00Z');
 const detail=response();await handler('get','/maestros/:ownerId/proyectos/:projectId')(req,detail);
 assert.equal(detail.body.data.verificationCode,code);
 const again=response();await handler('get','/maestros/:ownerId/proyectos')(req,again);
 assert.equal(again.body.data[0].verificationCode,code);
 assert.equal(fixture.rows('cotizacionesVerificables').length,1);
 assert.equal(fixture.get('cotizacionesVerificables',code).recommendedUntil,'2020-01-11T00:00:00Z');
});

test('opening another account quotation cannot issue a code',async t=>{
 const fixture=firestoreFixture(t,{proyectos:{quote:{ownerId:'other',name:'Privada',items:[]}}});
 const result=response();await handler('get','/maestros/:ownerId/proyectos/:projectId')({authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'}},result);
 assert.equal(result.statusCode,404);
 assert.equal(fixture.get('proyectos','quote').verificationCode,undefined);
 assert.equal(fixture.rows('cotizacionesVerificables').length,0);
});


test('legacy code backfill reads the catalog before acquiring its transaction connection',async t=>{
 firestoreFixture(t,{proyectos:{quote:{ownerId:'master',name:'Antigua',items:[]}}});
 const runTransaction=db.runTransaction.bind(db),collection=db.collection.bind(db);
 let inTransaction=false;
 t.mock.method(db,'runTransaction',callback=>runTransaction(async tx=>{
   inTransaction=true;
   try {return await callback(tx);} finally {inTransaction=false;}
 }));
 t.mock.method(db,'collection',name=>{
   if(inTransaction) assert.ok([COLLECTIONS.projects,COLLECTIONS.quotationVerifications].includes(name),'Catalog queries must not acquire extra connections inside the transaction');
   return collection(name);
 });
 const result=response();await handler('get','/maestros/:ownerId/proyectos/:projectId')({authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'}},result);
 assert.equal(result.statusCode,200);assert.ok(result.body.data.verificationCode);
});
test('adding an item reads the catalog outside its transaction and preserves saved pricing and verification',async t=>{
 const savedOffer={productName:'Cemento',storeName:'Local',storeId:'store',productoFerreteriaId:'cement',price:1000,stock:10};
 const saved={ownerId:'master',name:'Obra',description:'Detalles',items:[{productName:'Cemento',quantity:1}],pricingOffers:[savedOffer],pricesCapturedAt:'2020-01-01T00:00:00Z',validUntil:'2020-01-11T00:00:00Z'};
 const fixture=firestoreFixture(t,{proyectos:{quote:saved}});
 const runTransaction=db.runTransaction.bind(db),collection=db.collection.bind(db);
 let inTransaction=false;
 t.mock.method(db,'runTransaction',callback=>runTransaction(async tx=>{
  inTransaction=true;
  try {return await callback(tx);} finally {inTransaction=false;}
 }));
 t.mock.method(db,'collection',name=>{
  if(inTransaction) assert.ok([COLLECTIONS.projects,COLLECTIONS.quotationVerifications].includes(name),'Catalog queries must not acquire extra connections inside the transaction');
  return collection(name);
 });
 const result=response();
 await handler('post','/maestros/:ownerId/proyectos/:projectId/items')({authRole:'maestro',authUserId:'master',params:{ownerId:'master',projectId:'quote'},body:{productName:'Cemento',quantity:2}},result);
 assert.equal(result.statusCode,201);
 assert.equal(result.body.data.totalOptimal,3000);
 assert.equal(result.body.data.description,saved.description);
 assert.equal(result.body.data.validUntil,saved.validUntil);
 assert.equal(result.body.data.expired,true);
 const updated=fixture.get('proyectos','quote');
 assert.deepEqual(updated.pricingOffers,[savedOffer]);
 assert.equal(updated.items.length,2);
 const record=fixture.get('cotizacionesVerificables',updated.verificationCode);
 assert.equal(record.lines.reduce((total,line)=>total+line.subtotal,0),3000);
 assert.equal(record.recommendedUntil,saved.validUntil);
});
