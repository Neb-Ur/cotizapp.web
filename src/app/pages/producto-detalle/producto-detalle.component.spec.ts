import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, filter } from 'rxjs';
import { convertToParamMap, ActivatedRoute, Router, provideRouter, NavigationEnd } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LoginComponent } from '../auth/login/login.component';
import { RegisterComponent } from '../auth/register/register.component';
import { provideLocationMocks } from '@angular/common/testing';
import { Location } from '@angular/common';
import { vi } from 'vitest';
import { ProductoDetalleComponent } from './producto-detalle.component';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';

const detail:any={productName:'Abrazadera metálica',brand:'Por especificar',sku:'',productType:'Abrazadera metálica',categoryName:'Fijaciones',subcategoryName:'Amarre',familyName:'Amarres',gallery:[],imageUrl:'',description:'',shortDescription:'',featureBullets:[],descriptionBlocks:[],technicalSheet:[],extraSections:[],stores:[],minPrice:0,maxPrice:0,unitLabel:'Unidad',packagingLabel:'Unidad'};
async function setup(){
 const params=new BehaviorSubject(convertToParamMap({slug:'abrazadera-metalica'}));
 const resolvers:Array<(value:any)=>void>=[];
 const offerResolvers:Array<(value:any)=>void>=[];
 const api={loadProductOffers:vi.fn(()=>new Promise(resolve=>offerResolvers.push(resolve))),loadProductSheet:vi.fn(()=>new Promise(resolve=>resolvers.push(resolve))),formatCurrency:(value:number)=>String(value),getProjects:()=>[]};
 await TestBed.configureTestingModule({imports:[ProductoDetalleComponent],providers:[
  {provide:ActivatedRoute,useValue:{paramMap:params,queryParamMap:new BehaviorSubject(convertToParamMap({}))}},
  {provide:Router,useValue:{navigate:vi.fn(),navigateByUrl:vi.fn()}},
  {provide:Location,useValue:{}},{provide:FirebaseDataService,useValue:api},
  {provide:AuthService,useValue:{currentUser:()=>null}},{provide:SeoService,useValue:{updateProduct:vi.fn(),markProductNotFound:vi.fn()}}
 ]}).compileComponents();
 const fixture=TestBed.createComponent(ProductoDetalleComponent);fixture.detectChanges();
 return {fixture,params,resolvers,offerResolvers,api,component:fixture.componentInstance as any};
}
describe('product detail loading',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('requests only the route product and replaces the skeleton with the detail',async()=>{
  const {fixture,resolvers,api}=await setup();
  expect(api.loadProductSheet).toHaveBeenCalledWith(undefined,'abrazadera-metalica');
  expect(fixture.nativeElement.querySelector('.detail-loading')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('.purchase-panel')).toBeNull();
  resolvers[0](detail);await Promise.resolve();await Promise.resolve();fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.detail-loading')).toBeNull();
  expect(fixture.nativeElement.querySelector('.purchase-panel h1').textContent).toContain('Abrazadera metálica');
 });
 it('ignores an old request that finishes after the next product starts loading',async()=>{
  const {fixture,resolvers,params,component}=await setup();
  params.next(convertToParamMap({slug:'otro-producto'}));
  resolvers[0](detail);await Promise.resolve();fixture.detectChanges();
  expect(component.detail).toBeNull();expect(component.isLoading).toBe(true);
  resolvers[1]({...detail,productName:'Otro producto'});await Promise.resolve();fixture.detectChanges();
  expect(component.detail.productName).toBe('Otro producto');expect(component.isLoading).toBe(false);
 });
 it('shows the sheet while offers load and ignores offers from the previous route',async()=>{
  const {fixture,resolvers,offerResolvers,params,component}=await setup();
  resolvers[0](detail);await Promise.resolve();fixture.detectChanges();
  expect(component.isLoading).toBe(false);expect(component.offersLoading).toBe(true);
  expect(fixture.nativeElement.textContent).toContain('Cargando precios');
  expect(fixture.nativeElement.querySelector('.product-unavailable-alert')).toBeNull();
  params.next(convertToParamMap({slug:'otro-producto'}));
  offerResolvers[0]({...detail,stores:[{storeName:'Vieja',price:100}]});await Promise.resolve();
  expect(component.detail).toBeNull();
  resolvers[1]({...detail,productName:'Otro producto'});await Promise.resolve();
  offerResolvers[1]({...detail,productName:'Otro producto'});await Promise.resolve();fixture.detectChanges();
  expect(component.detail.productName).toBe('Otro producto');expect(component.offersLoading).toBe(false);
  expect(fixture.nativeElement.querySelector('.product-unavailable-alert')).not.toBeNull();
 });

 it('keeps the sheet and offers a retry when prices fail',async()=>{
  const {fixture,resolvers,api,component}=await setup();
  api.loadProductOffers.mockRejectedValueOnce(new Error('Sin conexión'));
  resolvers[0](detail);await Promise.resolve();await Promise.resolve();await Promise.resolve();fixture.detectChanges();
  expect(component.detail.productName).toBe('Abrazadera metálica');
  expect(component.offersLoading).toBe(false);expect(component.offersError).toContain('precios');
  expect(fixture.nativeElement.querySelector('.product-unavailable-alert')).toBeNull();
  expect(fixture.nativeElement.textContent).toContain('Reintentar');
 });

});

describe('product quotation workflow',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('preserves product, selected store and quantity when a guest creates a quotation',async()=>{
  const {component}=await setup();const router=TestBed.inject(Router) as any;
  router.createUrlTree=vi.fn(()=>({}));router.serializeUrl=vi.fn(()=>'/productos/abrazadera-metalica?crearCotizacion=1&ferreteriaId=s&cantidad=3');
  component.selectedStoreName='Tienda';component.selectedStoreId='s';component.selectedQuantity=3;
  component.openCreateQuotationModal();
  expect(component.isCreateQuotationModalOpen).toBe(false);
  expect(router.createUrlTree).toHaveBeenCalledWith([],expect.objectContaining({queryParams:expect.objectContaining({crearCotizacion:'1',ferreteriaId:'s',cantidad:3})}));
  expect(router.navigate).toHaveBeenCalledWith(['/registro'],expect.objectContaining({queryParams:expect.objectContaining({returnUrl:expect.stringContaining('crearCotizacion=1')})}));
 });
 it('creates and selects the quotation in a modal without adding the product twice',async()=>{
  const {component,api}=await setup();const auth=TestBed.inject(AuthService) as any;auth.currentUser=()=>({id:'owner',role:'maestro'});
  Object.assign(api,{saveProject:vi.fn(async()=>({id:'q',name:'Mi obra'})),addItemToProject:vi.fn()});
  component.openCreateQuotationModal();component.newQuotationName='Mi obra';await component.createQuotation();
  expect(component.selectedProjectId).toBe('q');expect(component.isCreateQuotationModalOpen).toBe(false);
  expect((api as any).saveProject).toHaveBeenCalledWith('owner','Mi obra',[],'');expect((api as any).addItemToProject).not.toHaveBeenCalled();
  expect(component.selectedQuotationName).toBe('Mi obra');
 });
 it('adds once to the selected quotation, showing loading and preserving the store attribution',async()=>{
  const {component,api}=await setup();const auth=TestBed.inject(AuthService) as any;auth.currentUser=()=>({id:'owner',role:'maestro'});
  let finish!:(value:any)=>void;Object.assign(api,{addItemToProject:vi.fn(()=>new Promise(resolve=>finish=resolve))});
  component.detail={...detail,productoMaestroId:'p'};component.selectedProjectId='q';component.selectedStoreId='s';component.selectedQuantity=2;
  component.displayStores=[{storeId:'s',storeName:'Tienda',offerId:'offer',price:1000,stock:5}];
  const adding=component.addToQuotation();expect(component.isAddingToQuotation).toBe(true);await component.addToQuotation();
  expect((api as any).addItemToProject).toHaveBeenCalledOnce();
  expect((api as any).addItemToProject).toHaveBeenCalledWith('owner','q',expect.objectContaining({productoMaestroId:'p',storeId:'s',productoFerreteriaId:'offer',quantity:2}));
  finish({name:'Mi obra'});await adding;expect(component.isAddingToQuotation).toBe(false);
 });
});


describe('product authentication navigation', () => {
 afterEach(() => TestBed.resetTestingModule());
 for (const existingAccount of [false, true]) {
 for (const productUrl of ['/productos/abrazadera-metalica', '/producto?product=Abrazadera%20met%C3%A1lica']) {
  it(`returns to the same product from ${existingAccount ? 'login' : 'registration'}: ${productUrl}`, async () => {
   const api = {
    loadProductSheet: vi.fn(async (name?: string, slug?: string) => name === detail.productName || slug === 'abrazadera-metalica' ? detail : null),
    loadProductOffers: vi.fn(async () => detail), formatCurrency: String, getProjects: () => []
   };
   await TestBed.configureTestingModule({providers: [
    provideRouter([
     {path: 'productos/:slug', component: ProductoDetalleComponent},
     {path: 'producto', component: ProductoDetalleComponent},
     {path: 'registro', component: RegisterComponent},
     {path: 'login', component: LoginComponent}
    ]), provideLocationMocks(),
    {provide: FirebaseDataService, useValue: api},
    {provide: AuthService, useValue: {currentUser: () => null}},
    {provide: SeoService, useValue: {updateProduct: vi.fn(), markProductNotFound: vi.fn()}}
   ]}).compileComponents();
   const harness = await RouterTestingHarness.create();
   const product = await harness.navigateByUrl(productUrl, ProductoDetalleComponent) as any;
   await harness.fixture.whenStable(); harness.detectChanges();
   product.goToLoginFromQuotationModal(existingAccount); await harness.fixture.whenStable(); harness.detectChanges();
   const returnUrl = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['returnUrl'];
   expect(returnUrl).toContain('crearCotizacion=1');
   expect(TestBed.inject(Router).url).toMatch(existingAccount ? /^\/login\?/ : /^\/registro\?/);
   const backLink = harness.routeNativeElement!.querySelector('.back-link') as HTMLAnchorElement;
   expect(backLink.getAttribute('href')).toBe(returnUrl);
   await harness.navigateByUrl(backLink.getAttribute('href')!, ProductoDetalleComponent);
   await harness.fixture.whenStable(); harness.detectChanges();
   expect(harness.routeNativeElement!.textContent).toContain('Abrazadera metálica');
   expect(harness.routeNativeElement!.textContent).not.toContain('No se encontro el producto');
   // Also cover the browser history back button, after a second visit to authentication.
   await harness.navigateByUrl(returnUrl, ProductoDetalleComponent);
   const returnedProduct = harness.routeDebugElement!.componentInstance as any;
   returnedProduct.goToLoginFromQuotationModal(existingAccount); await harness.fixture.whenStable();
   TestBed.inject(Router).setUpLocationChangeListener();
   const historyNavigation = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof NavigationEnd)));
   TestBed.inject(Location).back(); await historyNavigation; await harness.fixture.whenStable(); harness.detectChanges();
   await harness.fixture.whenStable(); harness.detectChanges();
   expect(harness.routeNativeElement!.textContent).toContain('Abrazadera metálica');
   expect(api.loadProductSheet.mock.calls.every(([name, slug]) => name === detail.productName || slug === 'abrazadera-metalica')).toBe(true);
  });
 }
 }
});

it('opens offer information without selecting or expanding the offer row', async () => {
 const {fixture,resolvers,offerResolvers,component}=await setup();
 const store={storeId:'s',storeName:'Ferretería Norte',stock:20,price:1200,offerConditions:'Retiro en local',includesVat:true,validFrom:'2026-10-09',priceUpdatedAt:'2026-10-09T12:00:00Z',source:'Ferretería',address:'Av. Principal 123'};
 resolvers[0](detail);await Promise.resolve();
 offerResolvers[0]({...detail,stores:[store]});await Promise.resolve();await Promise.resolve();fixture.detectChanges();
 const row=fixture.nativeElement.querySelector('.quick-stores li');
 expect(row.textContent).not.toContain('Actualizado');
 expect(row.textContent).not.toContain('Retiro en local');
 row.querySelector('app-info-panel button').click();fixture.detectChanges();
 expect(component.selectedStoreId).toBe('');
 const dialog=fixture.nativeElement.querySelector('[role="dialog"]');
 expect(dialog.textContent).toContain('Retiro en local');
 expect(dialog.textContent).toContain('Av. Principal 123');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
});
