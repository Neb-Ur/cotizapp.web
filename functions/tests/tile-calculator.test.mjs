import test from 'node:test';import assert from 'node:assert/strict';
import {calculateTiles,normalizeTilePlan} from '../lib/domain/tile-calculator.js';
import {emptyWorkBudget,applyWorkTemplate,normalizeWorkBudget,hasWorkTemplate,workTemplatePending} from '../lib/domain/work-budget.js';
const plan={version:1,priceUnitConfirmed:true,spaces:[{name:'Cocina',length:3.5,width:2.8,excludedArea:0},{name:'Pasillo',length:2,width:1,excludedArea:.2}],wastePercent:10,coveragePerBox:2,productId:'tile',productName:'Cerámica de piso'};
test('sums different spaces and exclusions, then rounds complete boxes once for the combined area',()=>{
 const result=calculateTiles(plan);assert.ok(Math.abs(result.area-11.6)<1e-10);assert.ok(Math.abs(result.requiredArea-12.76)<1e-10);assert.equal(result.boxes,7);assert.equal(result.purchasedArea,14);
 assert.equal(calculateTiles({...plan,spaces:[{name:'Exacto',length:1,width:1,excludedArea:0}],coveragePerBox:.1}).boxes,11);
});
test('rejects invalid measures, deductions, missing yield and unbounded quantities',()=>{
 for(const patch of [{spaces:[]},{spaces:Array(31).fill(plan.spaces[0])},{spaces:[{...plan.spaces[0],length:0}]},{spaces:[{...plan.spaces[0],width:NaN}]},{spaces:[{...plan.spaces[0],excludedArea:100}]},{coveragePerBox:0},{coveragePerBox:Infinity},{wastePercent:-1},{wastePercent:101},{spaces:[{name:'Grande',length:10000,width:10000,excludedArea:0}],coveragePerBox:.001}])assert.throws(()=>calculateTiles({...plan,...patch}));
});
test('stores inputs and explicit box-price confirmation, never user-posted totals',()=>{
 const normalized=normalizeTilePlan({...plan,boxes:1,total:1,spaces:[{...plan.spaces[0],name:' Cocina '}]});assert.equal(normalized.spaces[0].name,'Cocina');assert.equal(normalized.boxes,undefined);assert.equal(normalized.total,undefined);assert.equal(normalized.priceUnitConfirmed,true);
 for(const patch of [{priceUnitConfirmed:false},{productId:''},{version:2}])assert.throws(()=>normalizeTilePlan({...plan,...patch}));assert.equal(normalizeTilePlan(null),undefined);
});
test('tile and painting templates combine once while retaining original client, scope, terms and costs',()=>{
 const original={...emptyWorkBudget(),clientName:'Cliente',scope:'Alcance propio',terms:'Condiciones propias',markupPercent:25,labor:[{description:'Partida propia',unit:'hora',quantity:1,unitPrice:10000}]};
 const tiles=applyWorkTemplate(original,'tiles-v1');assert.equal(tiles.labor.length,6);assert.equal(tiles.expenses.length,2);assert.equal(tiles.templateId,'tiles-v1');assert.equal(original.labor.length,1);
 const combined=applyWorkTemplate(tiles,'painting-v1');assert.equal(hasWorkTemplate(combined,'tiles-v1'),true);assert.equal(hasWorkTemplate(combined,'painting-v1'),true);assert.equal(combined.scope,original.scope);assert.equal(combined.clientName,original.clientName);assert.equal(combined.terms,original.terms);assert.equal(combined.markupPercent,25);assert.equal(combined.labor[0].unitPrice,10000);
 assert.equal(combined.labor.filter(row=>row.description==='Limpieza final').length,1);assert.equal(combined.expenses.filter(row=>row.description==='Traslado').length,1);assert.deepEqual(applyWorkTemplate(combined,'tiles-v1'),combined);assert.deepEqual(normalizeWorkBudget(combined),combined);assert.equal(workTemplatePending(combined),true);
 combined.labor.forEach(row=>row.unitPrice=100);combined.expenses.forEach(row=>row.unitPrice=100);assert.equal(workTemplatePending(combined),false);
});
