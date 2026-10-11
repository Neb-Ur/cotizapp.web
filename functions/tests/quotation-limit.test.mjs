import test from 'node:test';
import assert from 'node:assert/strict';
import { projectsRouter } from '../lib/routes/projects.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const create = projectsRouter.stack.find(layer=>layer.route?.path==='/maestros/:ownerId/proyectos' && layer.route.methods.post).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('an account can create two quotations and the API rejects the third without writing another quotation',async t=>{
  const fixture=firestoreFixture(t);
  for(let i=1;i<=3;i++){
    const res=response();await create({authUserId:'master',authRole:'maestro',params:{ownerId:'master'},body:{nombre:`Obra ${i}`,items:[]}},res);
    assert.equal(res.statusCode,i<=2?201:409);
    if(i===3)assert.equal(res.body.error.code,'COTIZACION_LIMIT_REACHED');
  }
  assert.equal(fixture.rows('proyectos').length,2);
});
