import { vi } from 'vitest';
import { CatalogSearchComponent } from './catalog-search.component';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
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
    params.next(convertToParamMap({q: 'Cemento', categoria: 'construccion', rubro:'materiales', ferreteriaId: 'local-2'}));
    expect(api.searchProductPage).toHaveBeenCalledOnce();
    expect(api.searchProductPage).toHaveBeenCalledWith(expect.objectContaining({query: 'Cemento', area:'materiales', categoryId: 'construccion', storeId: 'local-2'}), 1, 20, 'relevance', undefined);
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
  expect(component.router.navigate).not.toHaveBeenCalled();
  expect(component.router.navigateByUrl).toHaveBeenCalledWith('/productos/abrazadera-metalica?projectTarget=nuevo');
 });
});

describe('collection filter context',()=>{
 it('retains a selected branch missing from the loaded directory options without duplicating listed branches', async()=>{
  const {api}=fixture();api.searchProductPage.mockResolvedValue({items:[],total:0,page:1,size:20} as any);
  await TestBed.configureTestingModule({imports:[CatalogSearchComponent],providers:[provideRouter([]),
   {provide:AuthService,useValue:{currentUser:()=>null}}, {provide:FirebaseDataService,useValue:api},
   {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({ferreteriaId:'branch-2',ferreteria:'Sucursal Sur'}))}},
   {provide:StoreDirectoryService,useValue:{list:async()=>({storeOptions:[{id:'branch-1',name:'Sucursal Norte'}]})}},
  ]}).compileComponents();
  const rendered=TestBed.createComponent(CatalogSearchComponent);
  try {
   rendered.detectChanges();await rendered.whenStable();rendered.detectChanges();
   const select=rendered.nativeElement.querySelector('.filters-grid select') as HTMLSelectElement;
   expect(select.value).toBe('branch-2');expect(select.selectedOptions[0].textContent).toContain('Sucursal Sur');
   (rendered.componentInstance as any).storeOptions.push({id:'branch-2',name:'Sucursal Sur'});
   rendered.changeDetectorRef.markForCheck();rendered.detectChanges();await rendered.whenStable();
   expect(select.querySelectorAll('option[value="branch-2"]')).toHaveLength(1);
  } finally { rendered.destroy();TestBed.resetTestingModule(); }
 });
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

it('ignores retired vehicle parameters and never forwards them to hardware searches',async()=>{
 const {component,api}=fixture();component.selectedVehicleBrandId='toyota';component.selectedVehicleModelId='corolla';component.selectedVehicleYear='2010';
 await component.fetchProductPage();
 const filters=(api.searchProductPage.mock.calls as any[][])[0][0];expect(filters.vehicleBrandId).toBeUndefined();expect(filters.vehicleModelId).toBeUndefined();expect(filters.vehicleYear).toBeUndefined();expect('showVehicleFilters' in component).toBe(false);
 expect(component.productUrl('Taladro')).not.toContain('vehiculo');
});

describe('mobile catalog filter surface', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  it('opens, traps reverse Tab, closes on Escape/backdrop and releases on desktop resize', async () => {
    vi.stubGlobal('innerWidth', 390);
    const {api} = fixture();
    api.searchProductPage.mockResolvedValue({items:[],total:0,page:1,size:20} as any);
    await TestBed.configureTestingModule({imports:[CatalogSearchComponent], providers:[provideRouter([]),
      {provide:AuthService,useValue:{currentUser:()=>null}}, {provide:FirebaseDataService,useValue:api},
      {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({}))}},
      {provide:StoreDirectoryService,useValue:{list:async()=>({storeOptions:[]})}},
    ]}).compileComponents();
    const rendered = TestBed.createComponent(CatalogSearchComponent);
    document.body.append(rendered.nativeElement);
    rendered.detectChanges(); await rendered.whenStable(); rendered.detectChanges();
    const trigger = rendered.nativeElement.querySelector('.filters-disclosure') as HTMLButtonElement;
    const panel = rendered.nativeElement.querySelector('.filters-section') as HTMLElement;
    expect(panel.hasAttribute('inert')).toBe(true);
    trigger.focus(); trigger.click(); rendered.detectChanges(); await rendered.whenStable();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(panel);
    expect(document.body.classList.contains('surface-open')).toBe(true);
    const reverse = new KeyboardEvent('keydown', {key:'Tab',shiftKey:true,bubbles:true,cancelable:true});
    panel.dispatchEvent(reverse);
    expect(reverse.defaultPrevented).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(panel);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); rendered.detectChanges();
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    trigger.click(); rendered.detectChanges(); await rendered.whenStable();
    rendered.nativeElement.querySelector('.filters-backdrop').click(); rendered.detectChanges();
    expect(panel.hasAttribute('inert')).toBe(true);
    trigger.click(); rendered.detectChanges(); await rendered.whenStable();
    vi.stubGlobal('innerWidth', 1200); window.dispatchEvent(new Event('resize')); rendered.detectChanges();
    expect(panel.getAttribute('aria-modal')).toBeNull();
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(document.body.classList.contains('surface-open')).toBe(false);
    rendered.destroy(); rendered.nativeElement.remove();
  });
});


describe('initial search loading and request scheduling',()=>{
 it('starts products before taxonomy finishes and coalesces initialization',async()=>{
  const {component,api}=fixture();let finish!:()=>void;
  api.refreshSearchTaxonomy.mockImplementation(()=>new Promise<undefined>(resolve=>finish=()=>resolve(undefined)));
  const first=component.loadCatalog(),second=component.loadCatalog();
  expect(first).toBe(second);expect(api.searchProductPage).toHaveBeenCalledOnce();
  await Promise.resolve();await Promise.resolve();
  expect(component.totalProducts).toBe(135);expect(component.resultsLabel).toBe('135 productos encontrados');
  finish();await first;
 });
 it('renders loading instead of a false empty count until an empty response is confirmed',async()=>{
  const {api}=fixture();let finish!:(value:any)=>void;
  api.searchProductPage.mockImplementation(()=>new Promise(resolve=>finish=resolve));
  await TestBed.configureTestingModule({imports:[CatalogSearchComponent],providers:[provideRouter([]),
    {provide:AuthService,useValue:{currentUser:()=>null}}, {provide:FirebaseDataService,useValue:api},
    {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({q:'mahindra'}))}},
    {provide:StoreDirectoryService,useValue:{list:async()=>({storeOptions:[]})}},
  ]}).compileComponents();
  const rendered=TestBed.createComponent(CatalogSearchComponent);rendered.detectChanges();
  expect(rendered.nativeElement.textContent).toContain('Cargando productos');
  expect(rendered.nativeElement.textContent).not.toContain('0 productos encontrados');
  expect(rendered.nativeElement.textContent).not.toContain('No encontramos productos');
  expect(rendered.nativeElement.querySelectorAll('.product-skeleton').length).toBeGreaterThan(0);
  finish({items:[],total:0,page:1,size:20});await rendered.whenStable();rendered.detectChanges();
  expect(rendered.nativeElement.textContent).toContain('0 productos encontrados');
  expect(rendered.nativeElement.querySelector('.catalog-loading')).toBeNull();
  rendered.destroy();TestBed.resetTestingModule();
 });
});
