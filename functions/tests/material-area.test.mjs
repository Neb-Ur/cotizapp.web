import test from 'node:test';import assert from 'node:assert/strict';
import {defaultAreaPlan,calculateMaterialArea,normalizeMaterialArea,estimateMaterialOffer} from '../lib/domain/material-area.js';
import {emptyWorkBudget,normalizeWorkBudget} from '../lib/domain/work-budget.js';
test('painting uses total m2, coats, loss and each local presentation before rounding and pricing',()=>{
 const p={...defaultAreaPlan('painting'),area:40,coverage:10,packageSize:4,confirmed:true};
 const a=estimateMaterialOffer(p,{price:14000,stock:10,measurementUnit:'l',measurementQuantity:4}),b=estimateMaterialOffer(p,{price:18000,stock:10,measurementUnit:'l',measurementQuantity:6});
 assert.equal(a.quantity,3);assert.equal(a.total,42000);assert.equal(b.quantity,2);assert.equal(b.total,36000);assert.equal(b.source,'offer');assert.ok(Math.abs(a.liters-8.8)<1e-9);
 assert.equal(estimateMaterialOffer({...p,confirmed:false},{price:14000,stock:10}).eligible,false);assert.equal(estimateMaterialOffer(p,{price:14000,stock:2}).eligible,false);
});
test('ceramics and boards use declared m2 per sale unit, whole packages and number of faces',()=>{
 const p={...defaultAreaPlan('tiles'),area:25,coverage:2,confirmed:true};
 assert.equal(estimateMaterialOffer(p,{price:10000,stock:20,measurementUnit:'m2',measurementQuantity:2}).quantity,14);
 const b=estimateMaterialOffer(p,{price:12000,stock:20,measurementUnit:'m2',measurementQuantity:2.5});assert.equal(b.quantity,11);assert.equal(b.total,132000);
 assert.equal(estimateMaterialOffer(p,{price:10000,stock:20,measurementUnit:'kg',measurementQuantity:25}).quantity,14);
 assert.equal(calculateMaterialArea({...p,kind:'partition',faces:2}).quantity,28);
 assert.equal(calculateMaterialArea({...p,area:10,coverage:.1,wastePercent:0}).quantity,100);
});
test('slab calculates m3 from m2 and cm without a mix recipe and uses supplied premix yield or declared m3',()=>{
 const p={...defaultAreaPlan('slab'),area:100,thicknessCm:10,packageSize:13,confirmed:true};
 const r=calculateMaterialArea(p);assert.ok(Math.abs(r.volume-11)<1e-9);assert.equal(r.quantity,847);
 const offer=estimateMaterialOffer(p,{price:120000,stock:20,measurementUnit:'m3',measurementQuantity:1});assert.equal(offer.quantity,11);assert.equal(offer.total,1320000);
 assert.equal(calculateMaterialArea({...p,packageSize:null}).quantity,null);
});
test('invalid dimensions, overflow, unsafe totals and malformed plans are rejected; incomplete yields stay explicit',()=>{
 const p={...defaultAreaPlan('painting'),area:40};assert.equal(calculateMaterialArea(p).quantity,null);
 for(const patch of [{area:0},{area:NaN},{coats:1.5},{coverage:-1},{packageSize:0},{wastePercent:101},{kind:'__proto__'}])assert.throws(()=>calculateMaterialArea({...p,...patch}));
 assert.throws(()=>calculateMaterialArea({...defaultAreaPlan('coverage'),area:1e7,coverage:.001}));
 assert.throws(()=>estimateMaterialOffer({...defaultAreaPlan('tiles'),area:1000000,coverage:1,confirmed:true},{price:1e12,stock:1e8}));
 const clean=normalizeMaterialArea({...p,quantity:1,total:1});assert.equal(clean.quantity,undefined);assert.equal(clean.total,undefined);
 const b=normalizeWorkBudget({...emptyWorkBudget(),materialPlans:[clean]});assert.deepEqual(b.materialPlans,[clean]);assert.throws(()=>normalizeWorkBudget({...emptyWorkBudget(),materialPlans:[clean,clean]}));
});
