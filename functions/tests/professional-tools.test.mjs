import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {normalizeProfessionalTools,normalizeWorkLedger,ledgerTotals} from '../lib/domain/professional-tools.js';
import {calculateConstruction,normalizeConstructionPlan} from '../lib/domain/construction-calculator.js';
import {emptyWorkBudget,normalizeWorkBudget,applyWorkTemplate,hasWorkTemplate} from '../lib/domain/work-budget.js';
import {normalizeCatalogCalculationSpecs} from '../lib/domain/catalog-calculation-specs.js';
import {projectsRouter} from '../lib/routes/projects.routes.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const response=()=>({statusCode:200,status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;}});
const handler=(method,path)=>projectsRouter.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const request=(body={},params={ownerId:'m'})=>({authUserId:'m',authRole:'maestro',params,body});
const contact={id:'c',name:'Ana',phone:'123',email:'ana@example.com',address:'Obra 1'};
const entry=(id,kind,quantity,unitPrice)=>({id,kind,date:'2026-10-25',description:'Registrado',quantity,unitPrice});
const plan=(kind)=>({version:1,kind,length:5,width:4,excludedArea:2,wastePercent:10,coverage:2,thicknessCm:10,faces:2,note:'Ficha confirmada'});
test('construction uses net area, faces and whole packages; slab volume uses centimeters',()=>{
 assert.equal(calculateConstruction(plan('floor')).packages,10);
 assert.equal(calculateConstruction(plan('partition')).packages,20);
 assert.equal(Number(calculateConstruction(plan('slab')).volume.toFixed(2)),1.98);
 assert.throws(()=>calculateConstruction({...plan('floor'),coverage:0}));
 assert.throws(()=>calculateConstruction({...plan('slab'),thicknessCm:null}));
 assert.throws(()=>calculateConstruction({...plan('partition'),faces:1.5}));
 assert.throws(()=>normalizeConstructionPlan({...plan('floor'),excludedArea:20}));
 assert.throws(()=>normalizeConstructionPlan(null));
});
test('payments, profit and cash flow remain distinct and reject invalid and duplicate movements',()=>{
 const ledger={version:1,revision:0,closed:false,entries:[entry('a','purchase',2,10000),entry('b','labor',1.5,20000),entry('c','payment',1,80000)]};
 const t=ledgerTotals(ledger,120000,70000);assert.deepEqual(t,{purchases:20000,labor:30000,expenses:0,paid:80000,cost:50000,balance:40000,credit:0,profit:70000,cash:30000,variance:20000,closed:false});
 assert.equal(ledgerTotals({...ledger,entries:[entry('p','payment',1,150000)]},120000,0).credit,30000);
 assert.throws(()=>normalizeWorkLedger({...ledger,entries:[entry('a','expense',1,-10)]}));
 assert.throws(()=>normalizeWorkLedger({...ledger,entries:[entry('a','expense',1,10),entry('a','payment',1,10)]}));
 assert.throws(()=>normalizeWorkLedger({...ledger,entries:[{...entry('a','expense',1,10),date:'2026-02-30'}]}));
});
test('client/profile snapshots and construction estimates survive disabled and enabled budgets and templates are additive',()=>{
 let budget={...emptyWorkBudget(),client:contact,professional:{businessName:'Mi empresa',email:'yo@example.com',phone:'',address:'',defaultTerms:'Anticipo acordado'},constructionPlans:[normalizeConstructionPlan(plan('floor'))]};
 assert.deepEqual(normalizeWorkBudget(budget),budget);
 for(const id of ['floor-v1','partition-v1','slab-v1']){budget=applyWorkTemplate(budget,id);assert.ok(hasWorkTemplate(budget,id));assert.deepEqual(applyWorkTemplate(budget,id),budget);}
 assert.deepEqual(normalizeWorkBudget(budget).client,contact);
 assert.throws(()=>normalizeProfessionalTools({version:1,clients:[contact,contact],profile:{}}));
 assert.throws(()=>normalizeProfessionalTools({version:1,clients:[{...contact,email:'bad'}],profile:{}}));
 assert.throws(()=>normalizeProfessionalTools({version:1,clients:[],profile:{logo:{data:'javascript:bad',width:1,height:1}}}));
});
test('technical specs require provenance and positive real measures',()=>{
 assert.equal(normalizeCatalogCalculationSpecs(null),null);
 assert.throws(()=>normalizeCatalogCalculationSpecs({saleUnit:'caja',source:''}));
 assert.throws(()=>normalizeCatalogCalculationSpecs({saleUnit:'envase',source:'Fabricante',paintCoverage:10}));
 assert.throws(()=>normalizeCatalogCalculationSpecs({saleUnit:'caja',source:'Fabricante',coveragePerPackage:-1}));
 assert.equal(normalizeCatalogCalculationSpecs({saleUnit:'caja',source:'Fabricante, caja 2 m2',coveragePerPackage:2}).coveragePerPackage,2);
});
test('private tools enforce owner access, revision checks, logo sanitization and preserve existing user fields',async t=>{
 const f=firestoreFixture(t,{usuarios:{m:{rol:'maestro',nombre:'Maestro'}}});
 const get=handler('get','/maestros/:ownerId/herramientas'),put=handler('put','/maestros/:ownerId/herramientas');
 const denied=response();await get(request({}, {ownerId:'other'}),denied);assert.equal(denied.statusCode,403);
 const logo=await sharp({create:{width:20,height:10,channels:3,background:'#f80'}}).jpeg().toBuffer();
 const tools=normalizeProfessionalTools({version:1,clients:[contact],profile:{businessName:'Empresa',logo:{data:'data:image/jpeg;base64,'+logo.toString('base64'),width:20,height:10}}});
 const saved=response();await put(request(tools),saved);assert.equal(saved.statusCode,200);assert.equal(saved.body.data.revision,1);assert.equal(saved.body.data.profile.logo.width,20);assert.equal(f.get('usuarios','m').nombre,'Maestro');
 const stale=response();await put(request(tools),stale);assert.equal(stale.statusCode,409);assert.equal(f.get('usuarios','m').professionalTools.clients.length,1);
 const bad=response();await put(request({...tools,revision:1,profile:{logo:{data:'data:image/jpeg;base64,/9j/AAAA',width:1,height:1}}}),bad);assert.equal(bad.statusCode,400);
});
test('ledger saves preserve quotation state, price verification and professional snapshots, with ownership and revision checks',async t=>{
 const f=firestoreFixture(t,{proyectos:{q:{ownerId:'m',name:'Obra',items:[],workflowStatus:'accepted',verificationCode:'CODE',workBudget:{...emptyWorkBudget(),client:contact}}}});
 const put=handler('put','/maestros/:ownerId/proyectos/:projectId/movimientos');const ledger={version:1,revision:0,closed:false,entries:[entry('p','payment',1,20000)]};
 const req=request(ledger,{ownerId:'m',projectId:'q'});const saved=response();await put(req,saved);assert.equal(saved.statusCode,200);
 const p=f.get('proyectos','q');assert.equal(p.workflowStatus,'accepted');assert.equal(p.verificationCode,'CODE');assert.deepEqual(p.workBudget.client,contact);assert.equal(p.ledger.revision,1);
 const stale=response();await put(req,stale);assert.equal(stale.statusCode,409);
 const denied=response();await put({...req,params:{ownerId:'m',projectId:'absent'}},denied);assert.equal(denied.statusCode,404);
});
