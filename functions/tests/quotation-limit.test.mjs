import test from 'node:test';
import assert from 'node:assert/strict';
import { projectsRouter } from '../lib/routes/projects.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const create = projectsRouter.stack.find(layer=>layer.route?.path==='/maestros/:ownerId/proyectos' && layer.route.methods.post).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('an account can create fifty quotations and the API rejects the fifty-first without writing another quotation',async t=>{
  const fixture=firestoreFixture(t);
  for(let i=1;i<=51;i++){
    const res=response();await create({authUserId:'master',authRole:'maestro',params:{ownerId:'master'},body:{nombre:`Obra ${i}`,items:[]}},res);
    assert.equal(res.statusCode,i<=50?201:409);
    if(i===51)assert.equal(res.body.error.code,'COTIZACION_LIMIT_REACHED');
  }
  assert.equal(fixture.rows('proyectos').length,50);
});

const duplicate=projectsRouter.stack.find(layer=>layer.route?.path==='/maestros/:ownerId/proyectos/:projectId/duplicar' && layer.route.methods.post).route.stack.at(-1).handle;
for(const limit of [0,3,75])test(`create and duplicate honor custom quota ${limit}`,async t=>{
 const count=limit===75?50:limit;
 const projects=Object.fromEntries(Array.from({length:count},(_,i)=>[`p${i}`,{ownerId:'master',name:`Obra ${i}`,items:[]} ]));
 projects.source={ownerId:'other',name:'Otra obra',items:[]};
 const fixture=firestoreFixture(t,{usuarios:{master:{quotationLimit:limit}},proyectos:projects});
 const req={authUserId:'master',authRole:'maestro',params:{ownerId:'master'},body:{nombre:'Nueva',items:[]}};
 let res=response();await create(req,res);assert.equal(res.statusCode,limit===75?201:409);
 if(limit!==75)assert.match(res.body.error.message,new RegExp(String(limit)));
 if(count){res=response();await duplicate({...req,params:{ownerId:'master',projectId:'p0'}},res);assert.equal(res.statusCode,limit===75?201:409);}
 assert.equal(fixture.rows('proyectos').filter(p=>p.ownerId==='master').length,count+(limit===75?2:0));
});
