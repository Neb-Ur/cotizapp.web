import test from 'node:test';import assert from 'node:assert/strict';
import {projectsRouter} from '../lib/routes/projects.routes.js';
import {emptyWorkBudget} from '../lib/domain/work-budget.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(method,path)=>projectsRouter.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const budget={...emptyWorkBudget(),enabled:true,clientName:'Cliente',observations:'Coordinar acceso a la obra.',exclusions:'No incluye retiro de escombros.',markupPercent:25,labor:[{description:'Pintura',quantity:2,unit:'jornada',unitPrice:50000}]};
const plan={version:1,length:5,height:4,surfaces:1,openings:0,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Pintura'};
test('budget and painting assumptions survive create, edit, legacy updates and item additions without leaking costs through verification',async t=>{
 const f=firestoreFixture(t,{usuarios:{master:{rol:'maestro',estadoCuenta:'activo'}}});
 const req={authRole:'maestro',authUserId:'master',params:{ownerId:'master'},body:{nombre:'Pintar casa',items:[{productName:'Pintura',quantity:2,productoMaestroId:'paint',calculationSource:'painting'}],workBudget:budget,paintingPlan:plan}};
 const created=response();await handler('post','/maestros/:ownerId/proyectos')(req,created);assert.equal(created.statusCode,201);
 const {id,verificationCode}=created.body.data;
 assert.deepEqual(f.get('proyectos',id).workBudget,budget);assert.deepEqual(created.body.data.paintingPlan,plan);assert.equal(created.body.data.items[0].calculationSource,'painting');
 assert.equal(f.get('cotizacionesVerificables',verificationCode).workBudget,undefined);
 const updated=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,params:{ownerId:'master',projectId:id},body:{nombre:'Casa',items:req.body.items}},updated);
 assert.deepEqual(updated.body.data.workBudget,budget);assert.deepEqual(updated.body.data.paintingPlan,plan);
 const added=response();await handler('post','/maestros/:ownerId/proyectos/:projectId/items')({...req,params:{ownerId:'master',projectId:id},body:{productName:'Cinta',quantity:1}},added);
 assert.deepEqual(added.body.data.workBudget,budget);assert.deepEqual(added.body.data.paintingPlan,plan);
 const cleared=response();await handler('put','/maestros/:ownerId/proyectos/:projectId')({...req,params:{ownerId:'master',projectId:id},body:{nombre:'Casa',items:[],paintingPlan:null}},cleared);assert.equal(cleared.body.data.paintingPlan,undefined);
});
test('invalid work costs are rejected at the router boundary before writes',()=>{
 const validation=projectsRouter.stack.find(l=>!l.route).handle;
 const res=response();validation({body:{workBudget:{...budget,markupPercent:-1}}},res,()=>assert.fail('invalid budget continued'));assert.equal(res.statusCode,400);assert.equal(res.body.error.code,'WORK_BUDGET_INVALID');
});
