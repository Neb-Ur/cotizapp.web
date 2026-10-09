import test from 'node:test';
import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {projectsRouter} from '../lib/routes/projects.routes.js';
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
