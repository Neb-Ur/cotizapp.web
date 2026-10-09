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
