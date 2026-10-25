import test from 'node:test';import assert from 'node:assert/strict';
import {projectsRouter} from '../lib/routes/projects.routes.js';import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(method,path)=>projectsRouter.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const plan={version:1,priceUnitConfirmed:true,spaces:[{name:'Baño',length:3,width:2,excludedArea:1}],wastePercent:10,coveragePerBox:2,productId:'tile',productName:'Cerámica de piso'};
const item={productName:plan.productName,productoMaestroId:'tile',quantity:3,calculationSource:'tiles'};
const req=(id,body)=>({authUserId:'master',authRole:'maestro',params:{ownerId:'master',projectId:id},body});
test('tile assumptions and generated line survive create, legacy edit, item addition and duplication; removing the tile clears the plan',async t=>{
 const f=firestoreFixture(t);
 const created=response();await handler('post','/maestros/:ownerId/proyectos')(req('',{nombre:'Baño',tilePlan:plan,items:[item]}),created);assert.equal(created.statusCode,201);const id=created.body.data.id;assert.deepEqual(created.body.data.tilePlan,plan);assert.equal(created.body.data.items[0].calculationSource,'tiles');assert.equal(f.get('cotizacionesVerificables',created.body.data.verificationCode).tilePlan,undefined);
 const edit=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')(req(id,{nombre:'Baño editado',items:[item]}),edit);assert.deepEqual(edit.body.data.tilePlan,plan);
 const added=response();await handler('post','/maestros/:ownerId/proyectos/:projectId/items')(req(id,{productName:'Crucetas',quantity:1}),added);assert.deepEqual(added.body.data.tilePlan,plan);
 const copy=response();await handler('post','/maestros/:ownerId/proyectos/:projectId/duplicar')(req(id,{}),copy);assert.equal(copy.statusCode,201);assert.deepEqual(copy.body.data.tilePlan,plan);assert.equal(copy.body.data.workflowStatus,'draft');
 const removed=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')(req(id,{nombre:'Baño',items:[{productName:'Crucetas',quantity:1}]}),removed);assert.equal(removed.body.data.tilePlan,undefined);assert.equal(f.get('proyectos',id).tilePlan,null);
});
test('invalid or unconfirmed tile assumptions stop before any project write',()=>{
 const validation=projectsRouter.stack.find(layer=>!layer.route).handle;
 for(const tilePlan of [{...plan,priceUnitConfirmed:false},{...plan,coveragePerBox:0}]){const res=response();validation({body:{tilePlan}},res,()=>assert.fail('invalid input continued'));assert.equal(res.statusCode,400);assert.equal(res.body.error.code,'WORK_BUDGET_INVALID');}
});
