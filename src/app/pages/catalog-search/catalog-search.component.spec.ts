import { vi } from 'vitest';
import { CatalogSearchComponent } from './catalog-search.component';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { VehicleCatalogService } from '../../core/services/vehicle-catalog.service';
import { StoreDirectoryService } from '../../core/services/store-directory.service';

function fixture() {
  const api = {
    refreshSearchTaxonomy:vi.fn(async()=>undefined),
    searchProductPage:vi.fn(async()=>({items:[{productName:'Producto 134'}],total:135,page:7,size:20})),
    getCategoryOptions:()=>[],getSubcategoryOptions:()=>[],getFamilyOptions:()=>[],loadError:()=>''
  };
  const component = new CatalogSearchComponent({currentUser:()=>null} as unknown as AuthService,api as unknown as FirebaseDataService,{snapshot:{data:{}}} as unknown as ActivatedRoute,{} as Router);
  return {component:component as any,api};
}
describe('server-paginated product search',()=>{
  it('applies query and URL filters together before requesting a page', async () => {
    const {component, api} = fixture();
    const params = new Subject<ReturnType<typeof convertToParamMap>>();
    component.route = {queryParamMap: params};
    component.ngOnInit();
    await component.loadCatalog();
    api.searchProductPage.mockClear();
    params.next(convertToParamMap({q: 'Cemento', categoria: 'construccion', ferreteriaId: 'local-2'}));
    expect(api.searchProductPage).toHaveBeenCalledOnce();
    expect(api.searchProductPage).toHaveBeenCalledWith(expect.objectContaining({query: 'Cemento', categoryId: 'construccion', storeId: 'local-2'}), 1, 20, 'relevance', undefined);
    component.ngOnDestroy();
  });
  it('loads taxonomy and a single page, preserving the full total in the paginator',async()=>{
    const {component,api}=fixture();
    await component.loadCatalog();
    expect(api.refreshSearchTaxonomy).toHaveBeenCalledOnce();
    expect(api.searchProductPage).toHaveBeenCalledOnce();
    expect(component.paginatedProductRows).toHaveLength(1);
    expect(component.totalProducts).toBe(135);expect(component.totalPages).toBe(7);
    expect(component.currentPage).toBe(7);
  });
  it('sends filters, page, ordering and proximity to the server',async()=>{
    const {component,api}=fixture();
    component.tableProductSearch=' Producto 134 ';component.selectedCategoryId='cat';component.selectedSubcategoryId='sub';component.selectedFamilyId='fam';component.selectedBrand='Marca Uno';
    component.currentPage=3;component.pageSize=50;component.productSort='price-desc';component.nearbyEnabled=true;component.userLocation={latitude:0,longitude:0};
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
    await component.initializeCatalog();
    expect(component.dataLoadError).toContain('API unavailable');expect(component.catalogLoaded).toBe(false);
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
  expect(component.router.navigate).toHaveBeenCalledWith(['/cotizaciones/nueva'],expect.objectContaining({queryParams:expect.objectContaining({addProduct:'Abrazadera metálica'})}));
 });
});

describe('collection filter context',()=>{
 it('removes taxonomy without clearing the independently selected store or brand',()=>{
  const {component}=fixture();component.router.navigate=vi.fn();
  component.selectedCategoryId='cat';component.selectedSubcategoryId='sub';component.selectedFamilyId='fam';
  component.selectedStoreId='branch';component.selectedStoreName='Local';component.selectedBrand='Marca';
  component.clearCategoryFilter();
  expect(component.selectedStoreId).toBe('branch');expect(component.selectedBrand).toBe('Marca');
  expect(component.router.navigate).toHaveBeenCalledWith([],expect.objectContaining({queryParams:expect.objectContaining({categoria:null,subcategoria:null,familia:null,ferreteriaId:'branch',marca:'Marca'})}));
  component.clearAllFilters();expect(component.taxonomyFilterCount).toBe(0);
 });
 it('clears removed family and brand filters in the URL',()=>{
  const {component}=fixture();component.router.navigate=vi.fn();
  component.selectedFamilyId='family';component.selectedBrand='Marca';component.selectedBrandId='brand';
  component.clearFamilyFilter();
  expect(component.router.navigate).toHaveBeenLastCalledWith([],expect.objectContaining({queryParams:expect.objectContaining({familia:null,marcaId:'brand'})}));
  component.clearBrandFilter();
  expect(component.router.navigate).toHaveBeenLastCalledWith([],expect.objectContaining({queryParams:expect.objectContaining({marca:null,marcaId:null})}));
 });
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

describe('vehicle filters', () => {
 it('rejects invalid URL years and does not submit them when ordering changes', async () => {
  const {component,api}=fixture();component.searchReady=true;
  component.selectedVehicleYear='2010.5';
  expect(await component.fetchProductPage()).toBe(false);
  component.onProductSortChange('price-asc');
  expect(component.vehicleYearError).toContain('año');
  expect(api.searchProductPage).not.toHaveBeenCalled();
  component.selectedVehicleYear='2010';
  await component.fetchProductPage();
  expect(component.vehicleYearError).toBe('');
  expect(api.searchProductPage).toHaveBeenCalledOnce();
 });
 it('sends the complete vehicle and preserves it in the detail link', async () => {
  const {component,api}=fixture();
  component.selectedVehicleBrandId='toyota';component.selectedVehicleModelId='corolla';component.selectedVehicleYear='2010';
  await component.fetchProductPage();
  expect(api.searchProductPage).toHaveBeenCalledWith(expect.objectContaining({vehicleBrandId:'toyota',vehicleModelId:'corolla',vehicleYear:2010}),1,20,'relevance',undefined);
  const url=new URL(component.productUrl('Alternador'), 'https://test.local');
  expect(url.searchParams.get('vehiculoMarcaId')).toBe('toyota');expect(url.searchParams.get('vehiculoModeloId')).toBe('corolla');expect(url.searchParams.get('vehiculoAnio')).toBe('2010');
 });
 it('resets dependent model/year selections when brand or model changes', () => {
  const {component}=fixture();component.router.navigate=vi.fn();
  component.selectedVehicleModelId='old';component.selectedVehicleYear='2010';component.currentPage=7;
  component.onVehicleBrandChange('toyota');
  expect(component.selectedVehicleModelId).toBe('');expect(component.selectedVehicleYear).toBe('');expect(component.currentPage).toBe(1);
  component.selectedVehicleYear='2012';component.onVehicleModelChange('corolla');expect(component.selectedVehicleYear).toBe('');
  component.clearVehicleFilters();expect(component.taxonomyFilterCount).toBe(0);
 });
 it('clears the whole vehicle and dependent taxonomy when leaving auto parts',()=>{
  const {component}=fixture();component.router.navigate=vi.fn();
  component.selectedVehicleBrandId='toyota';component.selectedVehicleModelId='corolla';component.selectedVehicleYear='2010';
  component.selectedSubcategoryId='auto-sub';component.selectedFamilyId='auto-family';
  component.onCategoryInput('');
  expect(component.router.navigate).toHaveBeenCalledWith([],expect.objectContaining({queryParams:expect.objectContaining({vehiculoMarcaId:null,vehiculoModeloId:null,vehiculoAnio:null,subcategoria:null,familia:null})}));
 });
 it('does not submit invalid years and shows filters for automotive results', () => {
  const {component,api}=fixture();component.router.navigate=vi.fn();component.searchReady=true;
  component.productRows=[{categoryId:'cat-repuestos-automotrices'}];expect(component.showVehicleFilters).toBe(true);
  component.selectedVehicleBrandId='toyota';component.selectedVehicleModelId='corolla';
  component.onVehicleYearChange(2010.5);expect(component.vehicleYearError).toContain('año');expect(api.searchProductPage).not.toHaveBeenCalled();
 });
 it('renders Local and dependent vehicle controls in the automotive category', async () => {
  const {api}=fixture();api.searchProductPage.mockResolvedValue({items:[],total:0,page:1,size:20} as any);
  await TestBed.configureTestingModule({imports:[CatalogSearchComponent],providers:[
   {provide:AuthService,useValue:{currentUser:()=>null}}, {provide:FirebaseDataService,useValue:api},
   {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({categoria:'cat-repuestos-automotrices'}))}},
   {provide:Router,useValue:{navigate:vi.fn()}},
   {provide:StoreDirectoryService,useValue:{list:async()=>({storeOptions:[{id:'garage',name:'Desarmaduría Norte'}]})}},
   {provide:VehicleCatalogService,useValue:{publicCatalog:async()=>({brands:[{id:'toyota',nombre:'Toyota'}],models:[{id:'corolla',marcaId:'toyota',nombre:'Corolla'}]})}}
  ]}).compileComponents();
  const rendered=TestBed.createComponent(CatalogSearchComponent);rendered.detectChanges();await rendered.whenStable();rendered.detectChanges();
  const text=rendered.nativeElement.textContent;
  expect(text).toContain('Local');expect(text).toContain('Desarmaduría Norte');expect(text).toContain('Marca del vehículo');expect(text).toContain('Modelo del vehículo');expect(text).toContain('Año del vehículo');
  const selects=rendered.nativeElement.querySelectorAll('.filters-grid select');expect(selects[2].disabled).toBe(true);
  selects[1].value='toyota';selects[1].dispatchEvent(new Event('change'));
  await rendered.whenStable();rendered.detectChanges();await rendered.whenStable();
  expect((rendered.componentInstance as any).selectedVehicleBrandId).toBe('toyota');
  expect(rendered.nativeElement.querySelectorAll('.filters-grid select')[2].disabled).toBe(false);expect(text).not.toContain('Ferretería');
  rendered.destroy();TestBed.resetTestingModule();
 });
});
