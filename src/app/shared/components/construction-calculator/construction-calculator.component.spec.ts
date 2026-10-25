import {TestBed} from '@angular/core/testing';
import {it,expect} from 'vitest';
import {ConstructionCalculatorComponent} from './construction-calculator.component';
import {emptyWorkBudget,normalizeWorkBudget} from '../../../core/utils/work-budget.util';
it('retains all three calculation types, replaces only its own type and restores saved plans',()=>{
 TestBed.configureTestingModule({imports:[ConstructionCalculatorComponent]});const f=TestBed.createComponent(ConstructionCalculatorComponent),c:any=f.componentInstance;f.componentRef.setInput('budget',emptyWorkBudget());f.detectChanges();
 for(const kind of ['floor','partition','slab']){c.kind=kind;Object.assign(c.form,{length:5,width:4,coverage:2});c.save();}
 expect(normalizeWorkBudget(c.budget).constructionPlans).toHaveLength(3);c.kind='floor';c.form.length=10;c.save();expect(c.budget.constructionPlans).toHaveLength(3);expect(c.budget.constructionPlans.find((p:any)=>p.kind==='partition').length).toBe(5);c.forms.floor.length=1;c.restore();expect(c.form.length).toBe(10);f.destroy();
});
