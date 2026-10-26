import {TestBed} from '@angular/core/testing';import {it,expect} from 'vitest';
import {MaterialAreaCalculatorComponent} from './material-area-calculator.component';
import {defaultAreaPlan} from '../../../../../functions/src/domain/material-area';import {emptyWorkBudget,restoreWorkBudgetDraft} from '../../../core/utils/work-budget.util';
it('compares local package sizes and applies exactly the eligible offer quantity',()=>{
 TestBed.configureTestingModule({imports:[MaterialAreaCalculatorComponent]});const f=TestBed.createComponent(MaterialAreaCalculatorComponent),c:any=f.componentInstance;
 f.componentRef.setInput('product',{id:'paint',name:'Pintura',specs:{saleUnit:'envase',litersPerPackage:4,paintCoverage:10}});f.componentRef.setInput('offers',[{offerId:'a',storeName:'A',price:14000,stock:2,measurementUnit:'l',measurementQuantity:4},{offerId:'b',storeName:'B',price:18000,stock:10,measurementUnit:'l',measurementQuantity:6}]);f.detectChanges();
 c.form.area=40;c.form.confirmed=true;f.detectChanges();expect(c.rows[0].store.storeName).toBe('B');expect(c.rows[0].estimate.quantity).toBe(2);expect(c.rows[0].estimate.total).toBe(36000);
 let selected:any;c.offerSelected.subscribe((e:any)=>selected=e);c.choose(c.offers[0]);expect(selected).toBeUndefined();c.choose(c.offers[1]);expect(selected.quantity).toBe(2);expect(selected.store.offerId).toBe('b');
 c.overrides.b=2;c.yieldOverrides.b=5;c.form.confirmed=true;c.choose(c.offers[1]);expect(selected.quantity).toBe(9);expect(selected.plan.packageSize).toBe(2);expect(selected.plan.coverage).toBe(5);f.destroy();
});
it('saves separate surfaces per trade, restores them with incomplete cost drafts and retains entered values on offer refresh',()=>{
 const f=TestBed.createComponent(MaterialAreaCalculatorComponent),c:any=f.componentInstance;const budget={...emptyWorkBudget(),enabled:true};f.componentRef.setInput('budget',budget);f.detectChanges();
 c.form={...defaultAreaPlan('slab'),area:30,thicknessCm:12};c.save();c.form={...defaultAreaPlan('tiles'),area:20,coverage:2};c.save();expect(budget.materialPlans).toHaveLength(2);
 const restored=restoreWorkBudgetDraft({...budget,labor:[{description:'Trabajo',unit:'trabajo',quantity:1,unitPrice:null}]});expect(restored.materialPlans?.[0].area).toBe(30);
 f.componentRef.setInput('product',{id:'p',name:'Pintura'});f.detectChanges();c.form.area=42;f.componentRef.setInput('product',{id:'p',name:'Pintura'});f.detectChanges();expect(c.form.area).toBe(42);f.destroy();
});
