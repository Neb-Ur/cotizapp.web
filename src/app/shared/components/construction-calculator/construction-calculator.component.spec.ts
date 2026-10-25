import {TestBed} from '@angular/core/testing';
import {it,expect} from 'vitest';
import {ConstructionCalculatorComponent} from './construction-calculator.component';
import {emptyWorkBudget,normalizeWorkBudget} from '../../../core/utils/work-budget.util';
it('retains all three calculation types, replaces only its own type and restores saved plans',()=>{
 TestBed.configureTestingModule({imports:[ConstructionCalculatorComponent]});const f=TestBed.createComponent(ConstructionCalculatorComponent),c:any=f.componentInstance;f.componentRef.setInput('budget',emptyWorkBudget());f.detectChanges();
 for(const kind of ['floor','partition','slab']){c.kind=kind;Object.assign(c.form,{length:5,width:4,coverage:2});c.save();}
 expect(normalizeWorkBudget(c.budget).constructionPlans).toHaveLength(3);c.kind='floor';c.form.length=10;c.save();expect(c.budget.constructionPlans).toHaveLength(3);expect(c.budget.constructionPlans.find((p:any)=>p.kind==='partition').length).toBe(5);f.componentRef.setInput('budget',structuredClone(c.budget));f.detectChanges();expect(c.form.length).toBe(10);f.destroy();
});

it('keeps unapplied measurements when switching work types and when busy changes',()=>{
 TestBed.configureTestingModule({imports:[ConstructionCalculatorComponent]});const f=TestBed.createComponent(ConstructionCalculatorComponent),c:any=f.componentInstance;
 f.componentRef.setInput('budget',emptyWorkBudget());f.detectChanges();
 Object.assign(c.form,{length:5,width:4,coverage:2});c.save();c.form.length=8;
 c.kind='slab';c.restore();c.form.length=12;c.kind='floor';c.restore();
 expect(c.form.length).toBe(8);expect(c.budget.constructionPlans[0].length).toBe(5);
 f.componentRef.setInput('busy',true);f.detectChanges();f.componentRef.setInput('busy',false);f.detectChanges();expect(c.form.length).toBe(8);
 c.kind='slab';c.restore();expect(c.form.length).toBe(12);
 f.componentRef.setInput('budget',emptyWorkBudget());f.detectChanges();expect(c.form.length).toBeNull();f.destroy();
});
