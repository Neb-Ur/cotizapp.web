import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';
import {HomeDiscoveryStateService} from '../../core/services/home-discovery-state.service';
import {provideRouter, Router} from '@angular/router';
import {HomeComponent} from './home.component';
import {FirebaseDataService} from '../../core/services/firebase-data.service';
describe('Home catalog loading',()=>{
 const product={productName:'Cemento',imageUrl:'',brand:'Sin marca',productType:'Cemento',storeCount:0,minPrice:0,maxPrice:0,sellers:[]};
 it('renders cached cards immediately while refreshing, without keeping skeletons',async()=>{
  let finish!:()=>void;const pending=new Promise<void>(resolve=>finish=resolve);
  TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:{refreshPublicCatalogSection:()=>pending,refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[],categories:[]}),getPopularProductRows:()=>[product],getCategoryOptions:()=>[],formatCurrency:()=>''}}]});
  const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();
  expect(fixture.nativeElement.querySelectorAll('.home-product-card').length).toBe(1);
  expect(fixture.nativeElement.querySelector('.product-skeletons')).toBeNull();
  finish();await fixture.whenStable();expect(fixture.nativeElement.querySelector('.product-skeletons')).toBeNull();
 });
 it('loads only the small preview and never downloads the entire catalog',async()=>{
  let finish!: (value:any)=>void;
  const data={refreshPublicCatalogSection:vi.fn(),refreshPublicCatalogEnhancements:vi.fn(),getHomeCatalogPreview:vi.fn(()=>new Promise(resolve=>finish=resolve)),getPopularProductRows:()=>[],getCategoryOptions:()=>[],formatCurrency:()=>''};
  TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:data}]});
  const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();
  expect(fixture.nativeElement.querySelector('.product-skeletons')).not.toBeNull();
  finish({products:[product],categories:[]});await fixture.whenStable();
  expect(fixture.nativeElement.querySelectorAll('.home-product-card').length).toBe(1);
  expect(fixture.nativeElement.querySelector('.product-skeletons')).toBeNull();
  expect(data.refreshPublicCatalogSection).not.toHaveBeenCalled();expect(data.refreshPublicCatalogEnhancements).not.toHaveBeenCalled();
 });
});

it('excludes automotive cards and categories from a stale home preview',async()=>{
 const general={productName:'Abrazadera',imageUrl:'',brand:'Marca',productType:'Material',storeCount:1,minPrice:100,maxPrice:100,sellers:['Local']};
 const auto={categoryId:'cat-repuestos-automotrices',productName:'Alternador automotriz',productoMaestroId:'auto',seoPath:'/productos/alternador-automotriz',imageUrl:'/auto.webp',brand:'Por especificar',productType:'Alternador',homeGroupLabel:'Repuestos',storeCount:0,minPrice:0,maxPrice:0,sellers:[]};
 TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:{refreshPublicCatalogSection:async()=>{},refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[general,auto],categories:[{id:'cat-repuestos-automotrices',name:'Repuestos automotrices',icon:'car'}]}),getPopularProductRows:()=>[general],getCategoryOptions:()=>[],formatCurrency:()=>''}}]});
 const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();await fixture.whenStable();fixture.detectChanges();
 expect(fixture.nativeElement.textContent).not.toContain('Alternador automotriz');expect(fixture.nativeElement.textContent).not.toContain('Repuestos automotrices');expect(fixture.nativeElement.querySelector('[href="/productos/alternador-automotriz"]')).toBeNull();
});


describe('guided home search',()=>{
 afterEach(()=>{TestBed.resetTestingModule();vi.restoreAllMocks();vi.unstubAllGlobals();});
 const auto={productName:'Taladro percutor',categoryId:'cat-herramientas-y-consumibles',productoMaestroId:'radiador',seoPath:'/productos/radiador-kuv',imageUrl:'/radiador.webp',brand:'Por especificar',productType:'Radiador',storeCount:0,minPrice:0,maxPrice:0,sellers:[]};
 async function setupDiscovery(){
  const data={refreshPublicCatalogSection:async()=>{},refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[auto],categories:[]}),getPopularProductRows:()=>[auto],getCategoryOptions:()=>[],formatCurrency:()=>'',searchProductPage:vi.fn(async()=>({items:[auto],page:1,size:6,total:1,totalPages:1,version:'v'}))};
  TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:data}]});
  const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();await fixture.whenStable();return {fixture,component:fixture.componentInstance as any,data,router:TestBed.inject(Router)};
 }
 it('connects hardware areas to suggestions without exposing a retired vehicle flow',async()=>{
  const {fixture,component,data,router}=await setupDiscovery();
  expect(fixture.nativeElement.textContent).not.toContain('Repuestos');
  component.selectArea('herramientas');await fixture.whenStable();
  expect(data.searchProductPage).toHaveBeenCalledWith({area:'herramientas'},1,24,'relevance');
  component.query='taladro';component.focusDiscovery();await fixture.whenStable();
  expect(data.searchProductPage).toHaveBeenLastCalledWith({area:'herramientas',query:'taladro'},1,6,'relevance');
  const navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);component.submitDiscovery();
  expect(navigate).toHaveBeenCalledWith(['/buscar'],{queryParams:{rubro:'herramientas',q:'taladro'}});
  component.selectArea('repuestos');expect(component.area).toBeUndefined();
  expect(TestBed.inject(HomeDiscoveryStateService).value.brand).toBe('');
 });
 it('aligns the focused search below the mobile header and adapts suggestions to the keyboard',async()=>{
  vi.stubGlobal('innerWidth',390);const viewport=Object.assign(new EventTarget(),{height:600,offsetTop:0});vi.stubGlobal('visualViewport',viewport);
  const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{cb(0);return 1;});
  const {fixture,component}=await setupDiscovery();const form=fixture.nativeElement.querySelector('.discovery-search');
  vi.spyOn(form,'getBoundingClientRect').mockReturnValue({top:300} as DOMRect);vi.spyOn(form.querySelector('input'),'getBoundingClientRect').mockReturnValue({bottom:350} as DOMRect);
  component.focusDiscovery();fixture.detectChanges();expect(scroll).toHaveBeenCalledWith({top:222,behavior:'instant'});
  const panel=fixture.nativeElement.querySelector('.discovery-suggestions');expect(panel.style.getPropertyValue('--suggestion-top')).toBe('358px');
  viewport.height=450;viewport.dispatchEvent(new Event('resize'));fixture.detectChanges();expect(panel.style.getPropertyValue('--suggestion-height')).toBe('80px');
  form.querySelector('input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));fixture.detectChanges();expect(fixture.nativeElement.querySelector('.discovery-suggestions')).toBeNull();expect(document.body.classList.contains('discovery-search-open')).toBe(false);
 });
 it('keeps the search stationary on desktop and ignores stale suggestion responses',async()=>{
  vi.stubGlobal('innerWidth',1280);const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  const {fixture,component,data}=await setupDiscovery();let finish!: (value:any)=>void;
  data.searchProductPage.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));
  component.query='viejo';component.focusDiscovery();component.query='radiador';component.focusDiscovery();await fixture.whenStable();
  finish({items:[{...auto,productName:'Resultado viejo'}]});await fixture.whenStable();fixture.detectChanges();
  expect(component.suggestions[0].productName).toContain('Taladro');expect(scroll).not.toHaveBeenCalled();
  component.onDiscoveryKeydown(new KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[role=combobox]').getAttribute('aria-activedescendant')).toBe('discovery-option-0');
 });
});
