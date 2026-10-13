import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
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
 it('replaces the initial skeleton after async data without a user interaction',async()=>{
  let available=false;let finish!:()=>void;
  TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:{refreshPublicCatalogSection:()=>new Promise<void>(resolve=>finish=()=>{available=true;resolve();}),refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[],categories:[]}),getPopularProductRows:()=>available?[product]:[],getCategoryOptions:()=>[],formatCurrency:()=>''}}]});
  const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();expect(fixture.nativeElement.querySelector('.product-skeletons')).not.toBeNull();
  finish();await fixture.whenStable();expect(fixture.nativeElement.querySelector('.product-skeletons')).toBeNull();expect(fixture.nativeElement.querySelectorAll('.home-product-card').length).toBe(1);
 });
 it('shows the small home preview while the full catalog is still downloading',async()=>{
  let finish!:()=>void;
  TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:{refreshPublicCatalogSection:()=>new Promise<void>(resolve=>finish=resolve),refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[product],categories:[]}),getPopularProductRows:()=>[],getCategoryOptions:()=>[],formatCurrency:()=>''}}]});
  const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('.product-skeletons')).toBeNull();expect(fixture.nativeElement.querySelectorAll('.home-product-card').length).toBe(1);
  finish();await fixture.whenStable();
 });
});

it('keeps the mixed home selection after the complete catalog and enhancements finish',async()=>{
 const general={productName:'Abrazadera',imageUrl:'',brand:'Marca',productType:'Material',storeCount:1,minPrice:100,maxPrice:100,sellers:['Local']};
 const auto={productName:'Alternador automotriz',productoMaestroId:'auto',seoPath:'/productos/alternador-automotriz',imageUrl:'/auto.webp',brand:'Por especificar',productType:'Alternador',homeGroupLabel:'Repuestos',storeCount:0,minPrice:0,maxPrice:0,sellers:[]};
 TestBed.configureTestingModule({imports:[HomeComponent],providers:[provideRouter([]),{provide:FirebaseDataService,useValue:{refreshPublicCatalogSection:async()=>{},refreshPublicCatalogEnhancements:async()=>{},getHomeCatalogPreview:async()=>({products:[general,auto],categories:[{id:'auto-category',name:'Repuestos automotrices',icon:'car'}]}),getPopularProductRows:()=>[general],getCategoryOptions:()=>[],formatCurrency:()=>''}}]});
 const fixture=TestBed.createComponent(HomeComponent);fixture.autoDetectChanges();await fixture.whenStable();fixture.detectChanges();
 expect(fixture.nativeElement.textContent).toContain('Alternador automotriz');expect(fixture.nativeElement.textContent).toContain('Repuestos automotrices');expect(fixture.nativeElement.querySelector('[href="/productos/alternador-automotriz"]')).not.toBeNull();expect(fixture.nativeElement.textContent).toContain('Sin ofertas disponibles');
});
