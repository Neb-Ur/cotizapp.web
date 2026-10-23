import { TestBed } from '@angular/core/testing';
import { RESPONSE_INIT } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { SeoService } from './seo.service';

describe('public SEO identity and real offers', () => {
  afterEach(() => document.getElementById('cotizapp-page-structured-data')?.remove());
  function product(overrides: any = {}) {
    return { productName:'Radiador Mahindra KUV100',seoPath:'/productos/radiador-kuv100',imageUrl:'',brand:'Mahindra',stores:[],...overrides } as any;
  }
  function setup() {
    TestBed.configureTestingModule({providers:[provideRouter([])]});
    return TestBed.inject(SeoService);
  }
  function schema() { return JSON.parse(document.getElementById('cotizapp-page-structured-data')!.textContent!); }
  it('escapes script delimiters for SSR without changing structured data values', () => {
    const productName = 'Radiador </script><script>alert(1)</script>';
    setup().updateProduct(product({productName}));
    expect(document.getElementById('cotizapp-page-structured-data')!.textContent).not.toContain('<');
    expect(schema()['@graph'][0].name).toBe(productName);
  });
  it('uses trovio.cl and excludes simulated and unavailable prices from rich results', () => {
    setup().updateProduct(product({stores:[{price:100,stock:1,pilot:true},{price:500,stock:0},{price:200,stock:2},{price:300,stock:1}]}));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://trovio.cl/productos/radiador-kuv100');
    expect(schema()['@graph'][0].offers).toMatchObject({lowPrice:200,highPrice:300,offerCount:2});
  });
  it('keeps test products out of the index and never marks their prices as offers', () => {
    setup().updateProduct(product({isTestProduct:true,stores:[{price:200,stock:1}]}));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    expect(schema()['@graph'][0].offers).toBeUndefined();
  });
  it('does not index collections made exclusively of test products', () => {
    setup().updateCollection({title:'Prueba',description:'Catálogo de prueba',path:'/categorias/prueba',name:'Prueba',index:false});
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
  });
  it('sets SSR status 404 for missing products and removes stale product structured data', () => {
    const responseInit: ResponseInit = {status:200};
    TestBed.configureTestingModule({providers:[provideRouter([]),{provide:RESPONSE_INIT,useValue:responseInit}]});
    const seo = TestBed.inject(SeoService);
    seo.updateProduct(product());
    seo.markProductNotFound();
    expect(responseInit.status).toBe(404);
    expect(document.getElementById('cotizapp-page-structured-data')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
  });
  it('sets SSR status 404 when the router resolves the existing wildcard page', async () => {
    const responseInit: ResponseInit = {status:200};
    TestBed.configureTestingModule({providers:[provideRouter([{path:'**',children:[]}]),{provide:RESPONSE_INIT,useValue:responseInit}]});
    TestBed.inject(SeoService).initialize();
    await TestBed.inject(Router).navigateByUrl('/pagina-inexistente');
    expect(responseInit.status).toBe(404);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
  });
});

describe('vehicle compatibility structured data',()=>{
 afterEach(()=>document.getElementById('cotizapp-page-structured-data')?.remove());
 it('keeps explicit fitment and used condition while excluding simulated fitment',()=>{
  TestBed.configureTestingModule({providers:[provideRouter([])]});const seo=TestBed.inject(SeoService);
  const product:any={productName:'Radiador Accent',seoPath:'/productos/radiador-accent',imageUrl:'',brand:'Hyundai',vehicleCompatibility:[{marcaNombre:'Hyundai',modeloNombre:'Accent',anioDesde:2015,anioHasta:2018}],stores:[{storeId:'local',storeName:'Local real',price:25000,stock:1,condition:'usado'}]};
  seo.updateProduct(product);let schema=JSON.parse(document.getElementById('cotizapp-page-structured-data')!.textContent!)['@graph'][0];
  expect(schema.additionalProperty[0].value).toContain('Hyundai Accent 2015–2018');
  expect(schema.offers.offers[0]).toMatchObject({price:25000,itemCondition:'https://schema.org/UsedCondition',seller:{name:'Local real'}});
  seo.updateProduct({...product,compatibilityReference:true});schema=JSON.parse(document.getElementById('cotizapp-page-structured-data')!.textContent!)['@graph'][0];
  expect(schema.additionalProperty).toBeUndefined();
 });
});
