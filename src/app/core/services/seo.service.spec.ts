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
    setup().updateProduct(product({productName,stores:[{price:1000,stock:1}]}));
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
    expect(schema()['@graph'].some((item: any) => item['@type'] === 'Product')).toBe(false);
    expect(schema()['@graph'][0]['@type']).toBe('WebPage');
  });
  it('keeps an informational page without invalid product markup when all offers are missing or unavailable', () => {
    setup().updateProduct(product({stores:[{price:100,stock:1,pilot:true},{price:100,stock:0},{price:0,stock:2},{price:Infinity,stock:1}]}));
    expect(schema()['@graph'].map((item: any) => item['@type'])).toEqual(['WebPage', 'BreadcrumbList']);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  });
  it('replaces server markup and removes duplicate owned scripts when offers change', () => {
    const seo = setup();
    for (let i = 0; i < 2; i++) {
      const script = document.createElement('script');
      script.id = 'cotizapp-page-structured-data';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({'@type':'Product',name:'Old product'});
      document.head.appendChild(script);
    }
    seo.updateProduct(product({stores:[{price:1000,stock:1}]}));
    expect(document.querySelectorAll('script[id="cotizapp-page-structured-data"]').length).toBe(1);
    expect(schema()['@graph'][0]['@id']).toBe('https://trovio.cl/productos/radiador-kuv100#product');
    seo.updateProduct(product());
    expect(schema()['@graph'].some((item: any) => item['@type'] === 'Product')).toBe(false);
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

describe('hardware structured data',()=>{
 afterEach(()=>document.getElementById('cotizapp-page-structured-data')?.remove());
 it('keeps offer condition without retired compatibility metadata',()=>{
  TestBed.configureTestingModule({providers:[provideRouter([])]});const seo=TestBed.inject(SeoService);
  const product:any={productName:'Radiador Accent',seoPath:'/productos/radiador-accent',imageUrl:'',brand:'Hyundai',vehicleCompatibility:[{marcaNombre:'Hyundai',modeloNombre:'Accent',anioDesde:2015,anioHasta:2018}],stores:[{storeId:'local',storeName:'Local real',price:25000,stock:1,condition:'usado'}]};
  seo.updateProduct(product);let schema=JSON.parse(document.getElementById('cotizapp-page-structured-data')!.textContent!)['@graph'][0];
  expect(schema.additionalProperty).toBeUndefined();
  expect(schema.offers.offers[0]).toMatchObject({price:25000,itemCondition:'https://schema.org/UsedCondition',seller:{name:'Local real'}});
  seo.updateProduct({...product,compatibilityReference:true});schema=JSON.parse(document.getElementById('cotizapp-page-structured-data')!.textContent!)['@graph'][0];
  expect(schema.additionalProperty).toBeUndefined();
 });
});
