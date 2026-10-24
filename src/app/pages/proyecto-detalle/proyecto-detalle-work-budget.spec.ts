import {vi} from 'vitest';
import {ProyectoDetalleComponent} from './proyecto-detalle.component';
import {GuestQuotationService} from '../../core/services/guest-quotation.service';
import {emptyWorkBudget} from '../../core/utils/work-budget.util';
import {buildQuotationOptimization} from '../../core/utils/quotation-optimizer.util';
function fixture(){
 const guest=new GuestQuotationService();
 const api:any={getMasterCatalogProducts:()=>[{id:'paint',masterProductId:'paint',name:'Látex blanco'}],buildProjectQuotation:(items:any[])=>buildQuotationOptimization(items,[{productoMaestroId:'paint',productName:'Látex blanco',storeName:'Local',price:10000,stock:20}])};
 const component:any=new ProyectoDetalleComponent({mode:()=> 'real'} as any,{snapshot:{data:{localQuotation:true},queryParamMap:{get:()=>null}}} as any,{navigate:vi.fn()} as any,{currentUser:()=>null} as any,api,undefined,undefined,undefined,guest);
 return {component,guest,api};
}
const plan={version:1 as const,length:5,height:4,surfaces:2,openings:4,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Látex blanco'};
beforeEach(()=>localStorage.clear());
it('recalculates only the generated painting line and persists assumptions alongside a guest work budget',async()=>{
 const {component,guest}=fixture();component.projectName='Pintar casa';component.workBudget={...emptyWorkBudget(),enabled:true,clientName:'Cliente',markupPercent:25,labor:[{description:'Pintura',unit:'jornada',quantity:1,unitPrice:50000}]};
 component.projectItems=[{productName:'Cinta',quantity:1}];
 await component.applyPaintingPlan(plan);expect(component.projectItems).toHaveLength(2);expect(component.projectItems[1].quantity).toBe(2);
 await component.applyPaintingPlan({...plan,coats:3});expect(component.projectItems).toHaveLength(2);expect(component.projectItems[1].quantity).toBe(3);
 await component.saveProject(false,false);
 const saved=guest.all()[0];expect(saved.workBudget?.clientName).toBe('Cliente');expect(saved.paintingPlan?.coats).toBe(3);expect(saved.items[0].productName).toBe('Cinta');
 await component.loadProject(saved.id);expect(component.workBudget.markupPercent).toBe(25);expect(component.paintingPlan.packLiters).toBe(4);
 component.removeProjectItem(1);expect(guest.get(saved.id)?.paintingPlan).toBeUndefined();
});
it('cost edits invalidate a saved quote and invalid costs prevent saving or export',async()=>{
 const {component}=fixture();component.isNewProject=false;component.projectItems=[{productName:'Látex blanco',quantity:2}];component.savedFingerprint=component.quotationFingerprint();
 component.workBudget.enabled=true;component.workBudget.markupPercent=25;expect(component.hasUnsavedChanges).toBe(true);expect(component.customerTotal).toBe(25000);
 component.workBudget.markupPercent=-1;expect(component.hasQuotation).toBe(false);await component.saveProject();expect(component.saveNotice).toContain('recargo');
});
it('restores the budget and painting assumptions through the new-quotation draft',async()=>{
 const {component}=fixture();component.workBudget.enabled=true;component.workBudget.clientName='Cliente';component.paintingPlan=plan;component.persistDraftIfNeeded();
 const other=fixture().component;await other.loadProject('nuevo');expect(other.workBudget.clientName).toBe('Cliente');expect(other.paintingPlan).toEqual(plan);
});
it('restores an unfinished local cost input for correction instead of blocking the quotation',async()=>{
 const {component}=fixture();component.workBudget={...emptyWorkBudget(),enabled:true,labor:[{description:'Pintura',unit:'jornada',quantity:1,unitPrice:null}]};component.persistDraftIfNeeded();
 const other=fixture().component;await other.loadProject('nuevo');expect(other.workBudget.labor[0].unitPrice).toBeNull();expect(other.budgetError).toBeTruthy();
 other.workBudget.labor[0].unitPrice=50000;expect(other.budgetError).toBe('');
});
