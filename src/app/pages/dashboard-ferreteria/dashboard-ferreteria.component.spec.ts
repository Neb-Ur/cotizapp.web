import { vi } from 'vitest';
import { DashboardFerreteriaComponent } from './dashboard-ferreteria.component';
const report:any={storeId:'store',computedAt:'2026-10-08T05:00:00Z',quotationCount:4,quotedProducts:2,catalog:{published:10,outOfStock:1},topProducts:[]};
function fixture(){
 const api:any={loadStoreDailyDashboard:vi.fn(async()=>({reports:[report]})),refreshFerreteriaCatalogSection:vi.fn(async()=>{}),refreshFerreteriaUploadSection:vi.fn(async()=>{}),getCatalog:vi.fn(()=>[])};
 const component:any=new DashboardFerreteriaComponent({currentUser:()=>({id:'owner',role:'ferreteria',ferreteriaId:'store'})} as any,api,{navigate:vi.fn()} as any,{} as any,{markForCheck:vi.fn()} as any);
 return {component,api};
}
it('reads the daily snapshot at home without downloading catalog or recalculating quotes',async()=>{
 const {component,api}=fixture();await component.ensureSectionData('inicio');
 expect(api.loadStoreDailyDashboard).toHaveBeenCalledWith('owner');expect(api.refreshFerreteriaCatalogSection).not.toHaveBeenCalled();
 expect(component.dailyReport.quotationCount).toBe(4);
 await component.ensureSectionData('inicio');expect(api.loadStoreDailyDashboard).toHaveBeenCalledOnce();
});
it('downloads catalog only when entering its maintenance section',async()=>{
 const {component,api}=fixture();await component.ensureSectionData('catalogo');
 expect(api.refreshFerreteriaCatalogSection).toHaveBeenCalledWith('owner',false);expect(api.loadStoreDailyDashboard).not.toHaveBeenCalled();
});
it('handles a failed snapshot independently so catalog management stays available',async()=>{
 const {component,api}=fixture();api.loadStoreDailyDashboard.mockRejectedValue(new Error('offline'));
 await component.ensureSectionData('inicio');expect(component.dashboardError).toBeTruthy();expect(component.isSectionLoading).toBe(false);
 await component.ensureSectionData('catalogo');expect(api.refreshFerreteriaCatalogSection).toHaveBeenCalledOnce();
});

it('keeps the latest master search when an earlier response arrives late',async()=>{
 const {component,api}=fixture();let firstResolve:any;
 api.searchMasterCatalogProducts=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>firstResolve=resolve))
  .mockResolvedValueOnce({items:[{id:'kuv',name:'Radiador Mahindra KUV100 2016–2019'}],total:1,totalPages:1,page:1});
 component.masterProductQuery='radiador';const first=component.loadMasterCatalog();
 component.masterProductQuery='radiador kuv';await component.loadMasterCatalog();
 firstResolve({items:[{id:'other',name:'Radiador de otro vehículo'}],total:1,totalPages:1,page:1});await first;
 expect(component.masterRows[0].id).toBe('kuv');
});
it('sends only one delete while confirmation is pending and clears a prior error after success',async()=>{
 const {component,api}=fixture();let resolveDelete:any;
 api.deleteCatalog=vi.fn(()=>new Promise(resolve=>resolveDelete=resolve));
 component.requestDeleteCatalog({id:'offer'});component.catalogError='Error anterior';
 const pending=component.confirmDeleteCatalog();const repeated=component.confirmDeleteCatalog();
 expect(api.deleteCatalog).toHaveBeenCalledTimes(1);
 component.closeDeleteCatalogModal();expect(component.deleteCatalogModalOpen).toBe(true);
 resolveDelete([]);await Promise.all([pending,repeated]);
 expect(component.deleteCatalogModalOpen).toBe(false);expect(component.catalogError).toBe('');
});
it('rejects a negative measurement quantity instead of silently clearing it on save',async()=>{
 const {component,api}=fixture();api.upsertCatalog=vi.fn(async()=>[]);
 component.openCatalogEdit({id:'offer',name:'Aceite',price:15000,stock:1,isPublished:true});
 component.catalogEditDraft.measurementUnit='l';component.catalogEditDraft.measurementQuantity=-1;
 await component.saveCatalogEdit();expect(api.upsertCatalog).not.toHaveBeenCalled();expect(component.catalogEditError).toBeTruthy();
});

it('limits category choices to the business type and keeps tools in hardware stores',()=>{
 const {component,api}=fixture();api.getCategoryOptions=()=>[{id:'materials'},{id:'tools'},{id:'cat-repuestos-automotrices'}];
 component.authService.currentUser=()=>({id:'owner',businessType:'desarmaduria'});
 expect(component.categoryOptions.map((c:any)=>c.id)).toEqual(['cat-repuestos-automotrices']);
 component.authService.currentUser=()=>({id:'owner',businessType:'repuestos'});
 expect(component.categoryOptions.map((c:any)=>c.id)).toEqual(['cat-repuestos-automotrices']);
 component.authService.currentUser=()=>({id:'owner',businessType:'ferreteria'});
 expect(component.categoryOptions.map((c:any)=>c.id)).toEqual(['materials','tools']);
});
