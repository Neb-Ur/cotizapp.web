import {TestBed} from '@angular/core/testing';
import {WorkBudgetEditorComponent} from './work-budget-editor.component';
import {emptyWorkBudget} from '../../../core/utils/work-budget.util';
it('updates the total through editable work costs and keeps PDF disclosure off by default',async()=>{
 await TestBed.configureTestingModule({imports:[WorkBudgetEditorComponent]}).compileComponents();
 const fixture=TestBed.createComponent(WorkBudgetEditorComponent);const c:any=fixture.componentInstance;
 c.budget={...emptyWorkBudget(),enabled:true,markupPercent:25};c.materials=100000;fixture.detectChanges();
 const add=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Agregar mano de obra')) as HTMLButtonElement;add.click();fixture.detectChanges();await fixture.whenStable();
 const label=Array.from(fixture.nativeElement.querySelectorAll('.cost-row label')).find((l:any)=>l.textContent.includes('Costo unitario')) as HTMLLabelElement;
 const input=label.querySelector('input')!;input.value='50000';input.dispatchEvent(new Event('input',{bubbles:true}));fixture.detectChanges();await fixture.whenStable();
 expect(c.budget.labor[0].unitPrice).toBe(50000);expect(c.totals.total).toBe(187500);expect(c.budget.discloseCosts).toBe(false);expect(fixture.nativeElement.textContent).toContain('Total presupuestado');fixture.destroy();
});
