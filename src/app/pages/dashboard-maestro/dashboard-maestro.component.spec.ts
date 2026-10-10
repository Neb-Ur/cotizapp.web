import { vi } from 'vitest';
import { DashboardMaestroComponent } from './dashboard-maestro.component';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { ActivatedRoute, Router } from '@angular/router';

function fixture() {
  const api = {
    refreshSearchTaxonomy:vi.fn(async()=>undefined),
    searchProductPage:vi.fn(async()=>({items:[{productName:'Producto 134'}],total:135,page:7,size:20})),
    getCategoryOptions:()=>[],getSubcategoryOptions:()=>[],getFamilyOptions:()=>[],loadError:()=>''
  };
  const component = new DashboardMaestroComponent({currentUser:()=>null} as unknown as AuthService,api as unknown as FirebaseDataService,{snapshot:{data:{publicCatalog:true}}} as unknown as ActivatedRoute,{} as Router);
  return {component:component as any,api};
}
describe('server-paginated product search',()=>{
  it('loads taxonomy and a single page, preserving the full total in the paginator',async()=>{
    const {component,api}=fixture();
    await component.ensureSectionData('buscar');
    expect(api.refreshSearchTaxonomy).toHaveBeenCalledOnce();
    expect(api.searchProductPage).toHaveBeenCalledOnce();
    expect(component.paginatedProductRows).toHaveLength(1);
    expect(component.totalProducts).toBe(135);expect(component.totalPages).toBe(7);
    expect(component.currentPage).toBe(7);
  });
  it('sends filters, page, ordering and proximity to the server',async()=>{
    const {component,api}=fixture();
    component.tableProductSearch=' Producto 134 ';component.selectedCategoryId='cat';component.selectedSubcategoryId='sub';component.selectedFamilyId='fam';component.selectedBrand='Marca Uno';
    component.currentPage=3;component.pageSize=50;component.productSort='price-desc';component.nearbyEnabled=true;component.maestroLocation={latitude:0,longitude:0};
    await component.fetchProductPage();
    expect(api.searchProductPage).toHaveBeenCalledWith({query:'Producto 134',categoryId:'cat',subcategoryId:'sub',familyId:'fam',brand:'Marca Uno'},3,50,'price-desc',{latitude:0,longitude:0,radiusKm:10});
  });
  it('ignores an old response arriving after a newer query',async()=>{
    const {component,api}=fixture();let resolveOld!:(value:any)=>void;
    api.searchProductPage.mockImplementationOnce(()=>new Promise(resolve=>resolveOld=resolve));
    const old=component.fetchProductPage();
    component.tableProductSearch='new';await component.fetchProductPage();
    resolveOld({items:[{productName:'Stale'}],total:1,page:1,size:20});await old;
    expect(component.productRows[0].productName).toBe('Producto 134');expect(component.totalProducts).toBe(135);
  });
  it('keeps a load failure visible during initial load and recovers on retry',async()=>{
    const {component,api}=fixture();api.searchProductPage.mockRejectedValueOnce(new Error('API unavailable'));
    component.currentSection='buscar';await component.initializeDashboard();
    expect(component.dataLoadError).toContain('API unavailable');expect(component.loadedSections.has('buscar')).toBe(false);
    await component.retryDataLoad();expect(component.dataLoadError).toBe('');expect(component.totalProducts).toBe(135);
  });
  it('fetches a new page and resets to page one when ordering changes',async()=>{
    const {component,api}=fixture();component.searchReady=true;
    api.searchProductPage.mockResolvedValueOnce({items:[{productName:'Producto 134'}],total:135,page:3,size:50});
    component.onProductsPageChange({page:2,rows:50});
    expect(api.searchProductPage.mock.calls[0].slice(1,4)).toEqual([3,50,'relevance']);
    await Promise.resolve();component.onProductSortChange('price-asc');
    expect(api.searchProductPage.mock.calls[1].slice(1,4)).toEqual([1,50,'price-asc']);
  });
});

describe('product card navigation',()=>{
 it('opens details through the router while retaining the anchor as fallback',()=>{
  const {component}=fixture();component.router.navigateByUrl=vi.fn();
  const event=new MouseEvent('click',{cancelable:true,button:0});
  component.selectProductCard(event,'Abrazadera metálica');
  expect(event.defaultPrevented).toBe(true);
  expect(component.router.navigateByUrl).toHaveBeenCalledWith('/productos/abrazadera-metalica');
 });
 it('lets modified clicks open a separate tab and preserves quotation selection',()=>{
  const {component}=fixture();component.router.navigateByUrl=vi.fn();component.router.navigate=vi.fn();
  const modified=new MouseEvent('click',{cancelable:true,button:0,ctrlKey:true});
  component.selectProductCard(modified,'Abrazadera metálica');
  expect(modified.defaultPrevented).toBe(false);expect(component.router.navigateByUrl).not.toHaveBeenCalled();
  component.projectTarget='nuevo';
  component.selectProductCard(new MouseEvent('click',{cancelable:true,button:0}),'Abrazadera metálica');
  expect(component.router.navigate).toHaveBeenCalledWith(['/dashboard/maestro/cotizaciones/nuevo'],expect.objectContaining({queryParams:expect.objectContaining({addProduct:'Abrazadera metálica'})}));
 });
});

describe('collection filter context',()=>{
 it('returns to public search when removing the defining family filter',()=>{
  const {component}=fixture();component.router.navigate=vi.fn();component.searchReady=true;
  component.landing={filters:{familia:'mdf'}};component.selectedFamilyId='mdf';
  component.clearFamilyFilter();
  expect(component.router.navigate).toHaveBeenCalledWith(['/buscar'],expect.objectContaining({queryParams:expect.objectContaining({familia:''})}));
 });
});

it('filters products by store ID and carries the branch into product details', async () => {
 const {component,api}=fixture();component.router.navigateByUrl=vi.fn();
 component.selectedStoreId='branch-2';component.selectedStoreName='Ferretería Central';
 await component.fetchProductPage();
 expect(api.searchProductPage).toHaveBeenCalledWith(expect.objectContaining({storeId:'branch-2'}),1,20,'relevance',undefined);
 expect(component.taxonomyFilterCount).toBe(1);
 component.selectProductCard(new MouseEvent('click',{cancelable:true,button:0}),'Cemento');
 const url=component.router.navigateByUrl.mock.calls[0][0];
 expect(url).toContain('/productos/cemento?');
 expect(new URL(url,'https://test.local').searchParams.get('ferreteriaId')).toBe('branch-2');
});
