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
 const vehicleParams=new BehaviorSubject(convertToParamMap({}));
 const params=new BehaviorSubject(convertToParamMap({slug:'abrazadera-metalica'}));
 const resolvers:Array<(value:any)=>void>=[];
 const offerResolvers:Array<(value:any)=>void>=[];
 const api={loadProductOffers:vi.fn(()=>new Promise(resolve=>offerResolvers.push(resolve))),loadProductSheet:vi.fn(()=>new Promise(resolve=>resolvers.push(resolve))),formatCurrency:(value:number)=>String(value),getProjects:()=>[]};
 await TestBed.configureTestingModule({imports:[ProductoDetalleComponent],providers:[
  {provide:ActivatedRoute,useValue:{paramMap:params,queryParamMap:vehicleParams}},
  {provide:Router,useValue:{navigate:vi.fn(),navigateByUrl:vi.fn()}},
  {provide:Location,useValue:{}},{provide:FirebaseDataService,useValue:api},
  {provide:AuthService,useValue:{currentUser:()=>null}},{provide:SeoService,useValue:{updateProduct:vi.fn(),markProductNotFound:vi.fn()}}
 ]}).compileComponents();
 const fixture=TestBed.createComponent(ProductoDetalleComponent);fixture.detectChanges();
 return {fixture,params,vehicleParams,resolvers,offerResolvers,api,component:fixture.componentInstance as any};
}
describe('product detail loading',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('restores the requested branch after retrying failed offers even when names match',async()=>{
  const {resolvers,offerResolvers,api,vehicleParams,component}=await setup();
  api.loadProductOffers.mockRejectedValueOnce(new Error('Sin conexión'));
  vehicleParams.next(convertToParamMap({ferreteria:'Local',ferreteriaId:'branch-2'}));
  resolvers[1](detail);await Promise.resolve();await Promise.resolve();
  component.retryOffers();
  offerResolvers[0]({...detail,stores:[{storeId:'branch-1',storeName:'Local',price:100,stock:5},{storeId:'branch-2',storeName:'Local',price:200,stock:5}]});
  await Promise.resolve();await Promise.resolve();
  expect(component.selectedStoreId).toBe('branch-2');
  expect(component.selectedStore.price).toBe(200);
 });
 it('ignores earlier offer responses for the same product after a retry starts',async()=>{
  const {resolvers,offerResolvers,component}=await setup();
  resolvers[0](detail);await Promise.resolve();
  component.retryOffers();
  offerResolvers[1]({...detail,stores:[{storeId:'new',storeName:'Actual',price:200,stock:5}]});
  await Promise.resolve();await Promise.resolve();
  offerResolvers[0]({...detail,stores:[{storeId:'old',storeName:'Anterior',price:100,stock:5}]});
  await Promise.resolve();await Promise.resolve();
  expect(component.displayStores[0].storeId).toBe('new');
  expect(component.offersLoading).toBe(false);
 });
 it('retains the selected vehicle when loading and retrying offers',async()=>{
  const {fixture,resolvers,api,vehicleParams,component}=await setup();
  vehicleParams.next(convertToParamMap({vehiculoMarcaId:'toyota',vehiculoModeloId:'corolla',vehiculoAnio:'2010'}));
  resolvers[1](detail);await Promise.resolve();fixture.detectChanges();
  expect(api.loadProductOffers).toHaveBeenCalledWith(detail,{vehicleBrandId:'toyota',vehicleModelId:'corolla',vehicleYear:2010});
  expect(fixture.nativeElement.textContent).toContain('Ofertas filtradas por el vehículo seleccionado');
  component.retryOffers();expect(api.loadProductOffers).toHaveBeenLastCalledWith(detail,{vehicleBrandId:'toyota',vehicleModelId:'corolla',vehicleYear:2010});
 });
 it('requests only the route product and replaces the skeleton with the detail',async()=>{
  const {fixture,resolvers,api}=await setup();
  expect(api.loadProductSheet).toHaveBeenCalledWith(undefined,'abrazadera-metalica');
  expect(fixture.nativeElement.querySelector('.detail-loading')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('.purchase-panel')).toBeNull();
  resolvers[0](detail);await Promise.resolve();await Promise.resolve();fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.detail-loading')).toBeNull();
  expect(fixture.nativeElement.querySelector('.product-heading h1').textContent).toContain('Abrazadera metálica');
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
 beforeEach(()=>localStorage.clear());
 it('adds the exact offer and condition selected when a branch has several offers',async()=>{
  const {component,api}=await setup();Object.assign(api,{recordOfferEvent:vi.fn()});
  component.detail={...detail,productoMaestroId:'p'};
  component.newQuotationName='Repuestos';await component.createQuotation();
  component.displayStores=[{storeId:'s',storeName:'Local',offerId:'new',condition:'nuevo',price:1000,stock:5},{storeId:'s',storeName:'Local',offerId:'used',condition:'usado',price:500,stock:5}];
  component.selectStore('Local','s','used');
  expect(component.selectedStore.condition).toBe('usado');expect(component.selectedTotal).toBe(500);
  await component.addToQuotation();
  expect(component.guestQuotations.get(component.selectedProjectId).items[0].productoFerreteriaId).toBe('used');
  expect((api as any).recordOfferEvent).toHaveBeenCalledWith('used','select');
 });
 it('creates a guest quotation and adds the selected offer without opening authentication',async()=>{
  const {component,api}=await setup();const router=TestBed.inject(Router) as any;
  component.openCreateQuotationModal();expect(component.isCreateQuotationModalOpen).toBe(true);
  component.newQuotationName='Mi cocina';await component.createQuotation();
  component.detail={...detail,productoMaestroId:'p'};component.selectedStoreId='s';component.selectedQuantity=3;
  component.displayStores=[{storeId:'s',storeName:'Local',offerId:'o',price:1000,stock:5}];
  await component.addToQuotation();
  const quote=component.guestQuotations.get(component.selectedProjectId);
  expect(quote.name).toBe('Mi cocina');expect(quote.items).toEqual([expect.objectContaining({productoMaestroId:'p',storeId:'s',productoFerreteriaId:'o',quantity:3})]);
  expect(router.navigate).not.toHaveBeenCalled();component.goToSelectedQuotation();
  expect(router.navigate).toHaveBeenCalledWith(['/cotizaciones/local',quote.id]);
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
 const dialog=document.querySelector('.cdk-overlay-container [role="dialog"]')!;
 expect(dialog.textContent).not.toContain('Retiro en local');
 expect(dialog.textContent).not.toContain('Precio unitario');
 expect(dialog.textContent).not.toContain('Actualizado');
 expect(dialog.textContent).toContain('Oferta vigente desde');
 expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();
 expect(dialog.textContent).not.toContain('Av. Principal 123');
 expect(dialog.textContent).toContain('Fuente: Ferretería.');
 expect(dialog.textContent).toContain('Reportar precio incorrecto');
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));fixture.detectChanges();
 expect(document.querySelector('.cdk-overlay-container [role="dialog"]')).toBeNull();
});

it('mixes generic and seller photos, labels the image owner and never falls back to a generic image under a seller label',async()=>{
 const {fixture,resolvers,offerResolvers,component}=await setup();
 const generic={...detail,gallery:['https://generic.example/main.webp'],imageUrl:'https://generic.example/main.webp',imageFallbackUrl:'https://generic.example/fallback.webp',imageDisclosure:'Imagen genérica'};
 resolvers[0](generic);await fixture.whenStable();fixture.detectChanges();
 offerResolvers[0]({...generic,storePhotos:[{id:'photo',url:'https://cdn.example/part.webp',thumbnailUrl:'https://cdn.example/thumb.webp',storeId:'north',storeName:'Desarmaduría Norte',offerId:'offer',condition:'usado'}]});
 await fixture.whenStable();fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.photo-attribution').textContent).toContain('Imagen de catálogo');
 const thumb=fixture.nativeElement.querySelector('[aria-label="Ver foto 2 de Desarmaduría Norte"]');expect(thumb).not.toBeNull();thumb.click();fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.photo-attribution').textContent).toContain('Desarmaduría Norte');
 expect(fixture.nativeElement.querySelector('.photo-attribution').textContent).toContain('Usado');
 const image=fixture.nativeElement.querySelector('.main-image img');expect(image.getAttribute('src')).toBe('https://cdn.example/part.webp');
 image.dispatchEvent(new Event('error'));fixture.detectChanges();expect(image.getAttribute('src')).toContain('product-image-unavailable.svg');
 expect(fixture.nativeElement.querySelector('.gallery-panel').textContent).not.toContain('Imagen genérica');
 fixture.destroy();
});

describe('continuous offer comparison list',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('keeps sold-out offers last for both price and distance sorting',async()=>{
  const {component}=await setup();
  const offers=[{storeId:'empty',storeName:'Agotado',price:10,stock:0,latitude:0,longitude:0},{storeId:'far',storeName:'Disponible lejos',price:200,stock:3,latitude:0,longitude:1},{storeId:'near',storeName:'Disponible cerca',price:100,stock:2,latitude:0,longitude:.1}];
  expect(component.buildDisplayStores(offers).map((s:any)=>s.storeId)).toEqual(['near','far','empty']);
  component.nearbyLocation={latitude:0,longitude:0};component.storeSort='distance';
  expect(component.buildDisplayStores(offers).map((s:any)=>s.storeId)).toEqual(['near','far','empty']);
 });
 it('labels exhausted stock and disables quotation selection while retaining offer information',async()=>{
  const {fixture,resolvers,offerResolvers,component,api}=await setup();Object.assign(api,{recordOfferEvent:vi.fn()});
  resolvers[0](detail);await Promise.resolve();
  offerResolvers[0]({...detail,stores:[{storeId:'empty',offerId:'e',storeName:'Agotado',price:100,stock:0},{storeId:'available',offerId:'a',storeName:'Disponible',price:200,stock:2}]});
  await Promise.resolve();await Promise.resolve();fixture.detectChanges();
  await fixture.whenStable();fixture.detectChanges();
  const rows=fixture.nativeElement.querySelectorAll('.quick-stores li');
  expect(rows[0].textContent).toContain('Disponible');expect(rows[1].textContent).toContain('Agotado');
  expect(rows[1].textContent).not.toContain('Stock: 0');expect(rows[1].querySelector('input').disabled).toBe(true);
  expect(rows[1].querySelector('app-info-panel button').disabled).toBe(false);
  rows[1].click();expect(component.selectedStore).toBeNull();
  rows[0].click();expect(component.selectedOfferId).toBe('a');
  expect(fixture.nativeElement.querySelectorAll('.offer-list-heading').length).toBe(1);
  expect(Array.from(rows).every((row:any)=>!row.textContent.includes('Precio unitario'))).toBe(true);
  component.displayStores[0].stock=0;expect(component.selectedStore).toBeNull();expect(component.canShowAddToQuotation).toBe(false);
 });
});


describe('continuous product information',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('places the product title before the gallery and keeps technical data in native expandable sections',async()=>{
  const {fixture,resolvers}=await setup();
  resolvers[0]({...detail,shortDescription:'Abrazadera para fijaciones',technicalSheet:[{label:'Material',value:'Acero'}],sku:'AB-123',extraSections:[{id:'care',title:'Cuidados',points:['Mantener seco']}]});
  await fixture.whenStable();fixture.detectChanges();
  const root=fixture.nativeElement as HTMLElement;
  expect(root.querySelectorAll('h1').length).toBe(1);
  expect(root.querySelector('h1')!.compareDocumentPosition(root.querySelector('.gallery-panel')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const sections=Array.from(root.querySelectorAll<HTMLDetailsElement>('.information-section'));
  expect(sections.map(section=>section.open)).toEqual([true,false,false]);
  expect(sections[0].textContent).toContain('Abrazadera para fijaciones');
  sections[1].querySelector('summary')!.click();
  expect(sections[1].open).toBe(true);expect(sections[1].textContent).toContain('Acero');
  sections[2].querySelector('summary')!.click();
  expect(sections[2].open).toBe(true);expect(sections[2].textContent).toContain('AB-123');
  const extra=sections[2].querySelector<HTMLDetailsElement>('.extra-item')!;
  extra.querySelector('summary')!.click();expect(extra.open).toBe(true);expect(extra.textContent).toContain('Mantener seco');
  sections[0].querySelector('summary')!.click();expect(sections[0].open).toBe(false);
  expect(root.querySelector('[role="tablist"]')).toBeNull();
 });
});

it('selects the originating guest quotation in the detail without adding an item',async()=>{
 localStorage.clear();
 const {component,vehicleParams,resolvers}=await setup();
 const quote=component.guestQuotations.create('Cotización de origen');
 vehicleParams.next(convertToParamMap({projectTarget:`local:${quote.id}`}));
 resolvers[1](detail);await Promise.resolve();await Promise.resolve();
 expect(component.selectedProjectId).toBe(quote.id);
 expect(component.guestQuotations.get(quote.id).items).toHaveLength(0);
 TestBed.resetTestingModule();localStorage.clear();
});
