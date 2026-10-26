import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkBudget,applyWorkTemplate,normalizeWorkBudget,workBudgetTotals,calculatePainting,normalizePaintingPlan} from '../lib/domain/work-budget.js';
const budget=()=>({...emptyWorkBudget(),enabled:true,markupPercent:25,labor:[{description:'Pintar muros',unit:'jornada',quantity:2,unitPrice:50000}],expenses:[{description:'Traslado',unit:'trabajo',quantity:1,unitPrice:10000}]});
const painting=()=>({version:1,length:5,height:4,surfaces:2,openings:4,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Látex blanco'});
test('work budget adds final material costs once and applies a cost markup, not a sale margin',()=>{
 assert.deepEqual(workBudgetTotals(90000,budget()),{materials:90000,labor:100000,expenses:10000,cost:200000,markup:50000,total:250000});
 assert.equal(workBudgetTotals(100000,{...emptyWorkBudget(),enabled:true,markupPercent:25}).total,125000);
 assert.equal(workBudgetTotals(100000,{...budget(),enabled:false}).total,100000);
});
test('cost normalization rejects negative, non-finite, excessive and incomplete entries',()=>{
 for(const value of [-1,NaN,Infinity,1e10,null,'1000'])assert.throws(()=>normalizeWorkBudget({...budget(),labor:[{...budget().labor[0],unitPrice:value}]}));
 for(const value of [-1,101,null])assert.throws(()=>normalizeWorkBudget({...budget(),markupPercent:value}));
 assert.throws(()=>normalizeWorkBudget({...budget(),labor:[{...budget().labor[0],description:''}]}));
 assert.throws(()=>normalizeWorkBudget({...budget(),labor:Array(51).fill(budget().labor[0])}));
 assert.equal(normalizeWorkBudget(undefined).enabled,false);
});
test('painting calculates net surface, coats and extra loss before rounding complete packages up',()=>{
 const result=calculatePainting(painting());assert.equal(result.area,36);assert.ok(Math.abs(result.liters-7.92)<1e-10);assert.equal(result.packages,2);assert.equal(result.purchasedLiters,8);
 assert.equal(calculatePainting({...painting(),length:10,height:1,surfaces:1,openings:0,coats:1,coverage:10,wastePercent:0,packLiters:1}).packages,1);
 assert.equal(calculatePainting({...painting(),length:10.1,height:1,surfaces:1,openings:0,coats:1,coverage:10,wastePercent:0,packLiters:1}).packages,2);
});
test('painting rejects impossible surface, missing yield or package and fractional coats',()=>{
 for(const patch of [{length:0},{coverage:null},{coverage:0},{coats:1.5},{surfaces:0},{openings:40},{packLiters:0},{wastePercent:-1},{height:Infinity}])assert.throws(()=>calculatePainting({...painting(),...patch}));
 assert.throws(()=>normalizePaintingPlan({...painting(),productId:''}));
 const plan=normalizePaintingPlan({...painting(),packages:1,total:1});assert.equal('packages' in plan,false);assert.equal(calculatePainting(plan).packages,2);
});

test('optional observations and exclusions survive normalization, disabled budgets and combined templates',()=>{
 const current={...emptyWorkBudget(),observations:'  Coordinar acceso a la obra.  ',exclusions:'No incluye retiro de escombros.'};
 const disabled=normalizeWorkBudget(current);assert.equal(disabled.observations,'Coordinar acceso a la obra.');assert.equal(disabled.exclusions,current.exclusions);
 const combined=applyWorkTemplate(applyWorkTemplate(disabled,'painting-v1'),'tiles-v1');assert.equal(normalizeWorkBudget(combined).exclusions,current.exclusions);assert.equal(combined.observations,disabled.observations);
 assert.equal(normalizeWorkBudget({...current,observations:'x'.repeat(3500)}).observations.length,3000);
 const cleared=normalizeWorkBudget({...current,observations:' ',exclusions:''});assert.equal(cleared.observations,undefined);assert.equal(cleared.exclusions,undefined);
});

test('a complete project combines all trades without losing costs, terms or duplicating common tasks',()=>{
 let b={...emptyWorkBudget(),clientName:'Cliente',observations:'Acceso coordinado',exclusions:'No incluye permisos',terms:'Pago por avance'};
 for(const id of ['painting-v1','tiles-v1','partition-v1','floor-v1','slab-v1'])b=applyWorkTemplate(b,id);
 for(const label of ['Pintura:','Cerámicas y porcelanatos:','Tabiques:','Pisos flotantes o vinílicos:','Radier / losa:'])assert.ok(b.scope.includes(label),label);
 assert.equal(b.labor.filter(row=>row.description==='Limpieza final').length,1);assert.equal(b.expenses.filter(row=>row.description==='Traslado').length,1);
 b.labor=b.labor.map(row=>({...row,unitPrice:1000}));b.expenses=b.expenses.map(row=>({...row,unitPrice:2000}));
 const saved=normalizeWorkBudget(b);assert.equal(workBudgetTotals(10000,saved).total,10000+saved.labor.length*1000+saved.expenses.length*2000);
 assert.equal(saved.terms,'Pago por avance');assert.equal(saved.exclusions,'No incluye permisos');assert.deepEqual(applyWorkTemplate(saved,'painting-v1'),saved);
 const custom=applyWorkTemplate({...saved,templateIds:['painting-v1'],templateId:'painting-v1',scope:'Solo pintar el dormitorio.'},'tiles-v1');assert.equal(custom.scope,'Solo pintar el dormitorio.');
});
