import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
