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
