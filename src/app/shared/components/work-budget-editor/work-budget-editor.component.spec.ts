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
it('adds painting tasks once without overwriting existing client costs and flags costs still to review',async()=>{
 await TestBed.configureTestingModule({imports:[WorkBudgetEditorComponent]}).compileComponents();
 const fixture=TestBed.createComponent(WorkBudgetEditorComponent);const c:any=fixture.componentInstance;
 c.budget={...emptyWorkBudget(),clientName:'Cliente',scope:'Solo cocina',labor:[{description:'Reparación propia',quantity:1,unit:'trabajo',unitPrice:30000}]};fixture.detectChanges();
 const button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Usar plantilla')) as HTMLButtonElement;button.click();fixture.detectChanges();
 expect(c.budget.enabled).toBe(true);expect(c.budget.scope).toBe('Solo cocina');expect(c.budget.clientName).toBe('Cliente');expect(c.budget.labor[0].unitPrice).toBe(30000);expect(c.budget.labor.length).toBe(4);expect(c.templatePending).toBe(true);expect(button.disabled).toBe(true);
 expect(fixture.nativeElement.textContent).toContain('no agrega materiales ni cantidades');fixture.destroy();
});
it('offers ceramic tasks without losing the existing painting template or duplicating cleanup and transport',async()=>{
 const fixture=TestBed.createComponent(WorkBudgetEditorComponent);const c:any=fixture.componentInstance;c.budget=emptyWorkBudget();fixture.detectChanges();
 const buttons=()=>Array.from(fixture.nativeElement.querySelectorAll('.template-start button')) as HTMLButtonElement[];
 buttons().find(button=>button.textContent?.includes('Usar plantilla de pintura'))!.click();fixture.detectChanges();
 buttons().find(button=>button.textContent?.includes('Usar plantilla de cerámicas'))!.click();fixture.detectChanges();
 expect(c.budget.templateIds).toEqual(['painting-v1','tiles-v1']);expect(c.budget.labor.filter((row:any)=>row.description==='Limpieza final')).toHaveLength(1);expect(c.budget.expenses.filter((row:any)=>row.description==='Traslado')).toHaveLength(1);expect(c.templatePending).toBe(true);expect(buttons().filter(button=>/pintura|cerámicas/.test(button.textContent||'')).every(button=>button.disabled)).toBe(true);fixture.destroy();
});
