import {vi} from 'vitest';import {ProyectoDetalleComponent} from './proyecto-detalle.component';import {GuestQuotationService} from '../../core/services/guest-quotation.service';import {applyWorkTemplate,emptyWorkBudget} from '../../core/utils/work-budget.util';import {buildQuotationOptimization} from '../../core/utils/quotation-optimizer.util';
const tilePlan={version:1 as const,priceUnitConfirmed:true as const,spaces:[{name:'Cocina',length:3.5,width:2.8,excludedArea:0}],wastePercent:10,coveragePerBox:2,productId:'tile',productName:'Cerámica de piso'};
const paintPlan={version:1 as const,length:5,height:4,surfaces:1,openings:0,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Pintura blanca'};
function setup(params:Record<string,string>={}){
 const guest=new GuestQuotationService();const api:any={getMasterCatalogProducts:()=>[],buildProjectQuotation:(items:any[])=>buildQuotationOptimization(items,[{productoMaestroId:'tile',productName:'Cerámica de piso',storeName:'Local',price:20000,stock:100},{productoMaestroId:'paint',productName:'Pintura blanca',storeName:'Local',price:10000,stock:100}])};
 const c:any=new ProyectoDetalleComponent({mode:()=> 'real'} as any,{snapshot:{data:{localQuotation:true},queryParamMap:{get:(key:string)=>params[key]||null}}} as any,{navigate:vi.fn()} as any,{currentUser:()=>null} as any,api,undefined,undefined,undefined,guest);return {c,guest};
}
beforeEach(()=>localStorage.clear());
it('recalculates only the tile line and saves both calculators and combined templates across reloads',async()=>{
 const {c,guest}=setup();c.projectName='Cocina';c.workBudget=applyWorkTemplate(applyWorkTemplate(emptyWorkBudget(),'painting-v1'),'tiles-v1');
 await c.applyPaintingPlan(paintPlan);await c.applyTilePlan(tilePlan);expect(c.projectItems).toHaveLength(2);expect(c.projectItems[1].quantity).toBe(6);
 await c.applyTilePlan({...tilePlan,spaces:[{...tilePlan.spaces[0],length:5}]});expect(c.projectItems).toHaveLength(2);expect(c.projectItems[0].calculationSource).toBe('painting');expect(c.projectItems[1].quantity).toBe(8);
 await c.saveProject(false,false);const saved=guest.all()[0];expect(saved.tilePlan?.spaces[0].length).toBe(5);expect(saved.paintingPlan).toEqual(paintPlan);expect(saved.workBudget?.templateIds).toEqual(['painting-v1','tiles-v1']);
 await c.loadProject(saved.id);expect(c.tilePlan.coveragePerBox).toBe(2);expect(c.paintingPlan.packLiters).toBe(4);
 c.removeProjectItem(1);expect(guest.get(saved.id)?.tilePlan).toBeUndefined();expect(guest.get(saved.id)?.paintingPlan).toEqual(paintPlan);
});
it('restores a new draft with tile assumptions and opens the ceramic calculator through its direct link',async()=>{
 const {c}=setup();c.tilePlan=tilePlan;c.projectItems=[{productName:tilePlan.productName,productoMaestroId:'tile',quantity:6,calculationSource:'tiles'}];c.persistDraftIfNeeded();
 const other=setup({herramienta:'ceramicas'}).c;await other.loadProject('nuevo');expect(other.tilePlan).toEqual(tilePlan);expect(other.selectedCalculator).toBe('tiles');expect(other.showMaterialsCalculator).toBe(true);expect(other.projectItems[0].calculationSource).toBe('tiles');
});
