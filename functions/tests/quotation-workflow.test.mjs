import {db} from '../lib/lib/firebase.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectsRouter} from '../lib/routes/projects.routes.js';
import {emptyWorkBudget,paintingBudgetTemplate,normalizeWorkBudget,paintingTemplatePending} from '../lib/domain/work-budget.js';
import {COLLECTIONS} from '../lib/lib/collections.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const path='/maestros/:ownerId/proyectos/:projectId';
const handler=(method,url)=>projectsRouter.stack.find(l=>l.route?.path===url&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const budget={...emptyWorkBudget(),enabled:true,clientName:'Cliente anterior',labor:[{description:'Pintura',quantity:1,unit:'trabajo',unitPrice:50000}]};
const source={ownerId:'master',name:'Pintura casa',address:'Dirección anterior',description:'Alcance',items:[],createdAt:'2026-01-01T00:00:00Z',workBudget:budget,workflowStatus:'accepted',verificationCode:'TRV-AAAA-BBBB-CCCC-DDDD',validUntil:'2026-01-11T00:00:00Z',pricesCapturedAt:'2026-01-01T00:00:00Z',pricingOffers:[]};
const request=(body={},ownerId='master',projectId='original')=>({authRole:'maestro',authUserId:'master',params:{ownerId,projectId},body});
test('manual tracking preserves pricing, verification and source content; stale state or content is rejected',async t=>{
 const f=firestoreFixture(t,{proyectos:{original:source},cotizacionesVerificables:{[source.verificationCode]:{marker:'immutable'}}});
 const req=request({estado:'sent',estadoAnterior:'accepted',codigoVerificacion:source.verificationCode});
 const res=response();await handler('patch',path+'/estado')(req,res);assert.equal(res.statusCode,200);assert.equal(res.body.data.workflowStatus,'sent');
 const saved=f.get('proyectos','original');assert.equal(saved.verificationCode,source.verificationCode);assert.deepEqual(saved.pricingOffers,source.pricingOffers);assert.equal(saved.validUntil,source.validUntil);assert.deepEqual(saved.workBudget,budget);assert.equal(f.rows('cotizacionesVerificables').length,1);
 const stale=response();await handler('patch',path+'/estado')(req,stale);assert.equal(stale.statusCode,409);
 const changed=response();await handler('patch',path+'/estado')(request({estado:'accepted',estadoAnterior:'sent',codigoVerificacion:'old-code'}),changed);assert.equal(changed.statusCode,409);
 const invalid=response();await handler('patch',path+'/estado')(request({estado:'fake',estadoAnterior:'sent'}),invalid);assert.equal(invalid.statusCode,400);
});
test('tracking and duplication enforce owner isolation and do not create unauthorized copies',async t=>{
 const f=firestoreFixture(t,{proyectos:{original:{...source,ownerId:'other'}}});
 for(const [method,suffix,body] of [['patch','/estado',{estado:'sent',estadoAnterior:'draft'}],['post','/duplicar',{}]]){
  const denied=response();await handler(method,path+suffix)(request(body,'other'),denied);assert.equal(denied.statusCode,403);
  const missing=response();await handler(method,path+suffix)(request(body),missing);assert.equal(missing.statusCode,404);
 }
 assert.equal(f.rows('proyectos').length,1);
});
test('duplication starts a new draft without client identity, stale prices or verification and enforces the account quota',async t=>{
 const f=firestoreFixture(t,{proyectos:{original:{...source,proximity:{latitude:-33,longitude:-70,radiusKm:10},items:[{productName:'Pintura',quantity:2,productoMaestroId:'paint',calculationSource:'painting'}],pricingOffers:[{productName:'Pintura',productoMaestroId:'paint',storeName:'Viejo',price:1,stock:20}]}}});
 const result=response();await handler('post',path+'/duplicar')(request(),result);assert.equal(result.statusCode,201);
 const copy=result.body.data;assert.notEqual(copy.id,'original');assert.equal(copy.workflowStatus,'draft');assert.equal(copy.address,'');assert.equal(copy.workBudget.clientName,'');assert.deepEqual(copy.workBudget.labor,budget.labor);assert.equal(copy.pricingOffers.length,0);assert.equal(copy.totalOptimal,0);assert.equal(copy.availabilityStatus,'incomplete');assert.equal(copy.proximity,undefined);assert.notEqual(copy.verificationCode,source.verificationCode);assert.notEqual(copy.pricesCapturedAt,source.pricesCapturedAt);assert.equal(copy.items[0].calculationSource,'painting');assert.deepEqual(f.get('proyectos','original').workflowStatus,'accepted');
 for(let i=0;i<48;i++)await db.collection(COLLECTIONS.projects).doc(`quota-${i}`).set({ownerId:'master',name:'Existing',items:[]});
 const limit=response();await handler('post',path+'/duplicar')(request(),limit);assert.equal(limit.statusCode,409);assert.equal(f.rows('proyectos').length,50);assert.equal(f.rows('cotizacionesVerificables').length,1);
});
test('editing accepted content returns it to draft and unpriced templates cannot be marked sent',async t=>{
 const f=firestoreFixture(t,{proyectos:{original:source}});
 const edited=response();await handler('put',path)(request({nombre:'Nuevo alcance',items:[]}),edited);assert.equal(edited.statusCode,200);assert.equal(edited.body.data.workflowStatus,'draft');
 const pending=paintingBudgetTemplate(emptyWorkBudget());
 await (await import('../lib/lib/firebase.js')).db.collection(COLLECTIONS.projects).doc('original').update({workBudget:pending});
 const res=response();await handler('patch',path+'/estado')(request({estado:'sent',estadoAnterior:'draft',codigoVerificacion:edited.body.data.verificationCode}),res);assert.equal(res.statusCode,400);assert.equal(f.get('proyectos','original').workflowStatus,'draft');
});
test('painting template is additive, idempotent, preserves private settings and requires cost review',()=>{
 const original={...budget,scope:'Alcance propio',terms:'Condiciones propias',markupPercent:25};
 const template=paintingBudgetTemplate(original);assert.equal(template.scope,original.scope);assert.equal(template.terms,original.terms);assert.equal(template.clientName,original.clientName);assert.equal(template.markupPercent,25);assert.equal(original.labor.length,1);assert.equal(template.labor.length,4);assert.equal(paintingTemplatePending(template),true);
 assert.deepEqual(paintingBudgetTemplate(template),template);assert.deepEqual(normalizeWorkBudget(template),template);
 template.labor.forEach(row=>row.unitPrice=100);template.expenses=[];assert.equal(paintingTemplatePending(template),false);
});
test('a duplicate captures current catalog offers instead of the original price snapshot',async t=>{
 const {CURRENT_STORE_AGREEMENT_VERSION}=await import('../lib/lib/legal.js');
 const {storeAgreementDocumentHash}=await import('../lib/services/store-agreement.service.js');
 const paintingPlan={version:1,length:5,height:4,surfaces:1,openings:0,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Pintura'};
 firestoreFixture(t,{
  usuarios:{seller:{estadoCuenta:'activo'}},
  ferreterias:{store:{usuarioDuenoId:'seller',nombreComercial:'Local actual',tipoNegocio:'ferreteria',contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()}},
  productosMaestro:{paint:{nombre:'Pintura',estado:'activo'}},
  productosFerreteria:{offer:{productoMaestroId:'paint',ferreteriaId:'store',precio:15000,stock:20,activo:true,publicado:true}},
  proyectos:{original:{...source,paintingPlan,items:[{productName:'Pintura',productoMaestroId:'paint',quantity:2,calculationSource:'painting'}],pricingOffers:[{productName:'Pintura',productoMaestroId:'paint',storeName:'Viejo',price:1000,stock:20}]}}
 });
 const result=response();await handler('post',path+'/duplicar')(request(),result);assert.equal(result.statusCode,201);
 assert.equal(result.body.data.totalOptimal,30000);assert.equal(result.body.data.pricingOffers[0].price,15000);assert.equal(result.body.data.availabilityStatus,'ready');assert.deepEqual(result.body.data.paintingPlan,paintingPlan);
});
