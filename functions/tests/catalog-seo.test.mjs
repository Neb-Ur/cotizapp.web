import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogLandings, productSeoDescription } from '../lib/domain/catalog-seo.js';
import { brandIdentity } from '../lib/domain/brand-identity.js';
import { publicCatalogRouter } from '../lib/routes/public-catalog.routes.js';
import { publicPagesRouter } from '../lib/routes/public-pages.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const brand=brandIdentity('Stanley');
const products=[{id:'tool',nombre:'Destornillador Stanley',categoriaId:'c',subcategoriaId:'s',familiaId:'f',marcaId:brand.id,marca:'Stanley'},{id:'demo',nombre:'Producto ficticio',esPrueba:true,categoriaId:'demo-category'},{id:'off',nombre:'Inactivo',estado:'inactivo',familiaId:'f'}];
const catalog=[products,[{id:'c',nombre:'Herramientas'}],[{id:'s',nombre:'Manuales',categoriaId:'c'}],[{id:'f',nombre:'Destornilladores',subcategoriaId:'s'},{id:'empty',nombre:'Vacía'}],[brand,{id:'generic',nombre:'Por especificar'}]];
function response(){return {statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},type(){return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;}};}
function handler(router,path){return router.stack.find(l=>JSON.stringify(l.route?.path)===JSON.stringify(path)).route.stack.at(-1).handle;}
test('landing pages include only published products and useful families/brands',()=>{
 const pages=catalogLandings(catalog);assert.equal(pages.filter(p=>p.path!=='/repuestos').length,3);
 assert.equal(pages.find(p=>p.path==='/familias/destornilladores').filters.categoria,'c');
 assert.equal(pages.find(p=>p.path==='/marcas/stanley').products.length,1);
 assert.ok(!productSeoDescription(products[0]).includes('0 ferreterías'));
});
test('sitemap includes base products with no offers; collection HTML has crawlable links, canonical and real missing-page status',async t=>{
 firestoreFixture(t,{productosMaestro:Object.fromEntries(products.map(p=>[p.id,p])),categorias:{c:catalog[1][0]},subcategorias:{s:catalog[2][0]},familias:{f:catalog[3][0],empty:catalog[3][1]},marcas:{[brand.id]:brand},cachePublico:{'catalog-revision':{revision:99}}});
 const map=response();await handler(publicCatalogRouter,'/sitemap.xml')({},map);assert.match(map.body,/\/productos\/destornillador-stanley/);assert.match(map.body,/\/familias\/destornilladores/);assert.match(map.body,/\/marcas\/stanley/);assert.doesNotMatch(map.body,/inactivo|vacia|producto-ficticio|<lastmod>/);
 const h=handler(publicPagesRouter,['/repuestos','/:kind(categorias|familias|marcas|marcas-vehiculos|vehiculos)/:slug']);
 const page=response();await h({path:'/familias/destornilladores'},page,e=>{throw e;});assert.equal(page.statusCode,200);assert.match(page.body,/<h1>Destornilladores<\/h1>/);assert.match(page.body,/href="\/productos\/destornillador-stanley"/);assert.match(page.body,/CollectionPage/);assert.match(page.body,/rel="canonical" href="https:\/\/trovio.cl\/familias\/destornilladores"/);
 const missing=response();await h({path:'/familias/vacia'},missing,e=>{throw e;});assert.equal(missing.statusCode,404);assert.equal(missing.headers['X-Robots-Tag'],'noindex');
});

test('identical product names in different families keep distinct URLs and preserve the original URL',async t=>{
 const {seoProductSlug}=await import('../lib/domain/catalog-seo.js');
 const {getProductSheet}=await import('../lib/lib/product-sheet-cache.js');
 const items=[{id:'electric',nombre:'Conector rápido',familiaId:'e'},{id:'water',nombre:'Conector rápido',familiaId:'w'}];
 firestoreFixture(t,{productosMaestro:{electric:items[0],water:items[1]},familias:{e:{nombre:'Electricidad'},w:{nombre:'Riego'}},cachePublico:{'catalog-revision':{revision:100}}});
 const first=seoProductSlug(items[0],items), second=seoProductSlug(items[1],items);
 assert.equal(first,'conector-rapido');assert.notEqual(first,second);assert.equal(seoProductSlug(items[1],[...items].reverse()),second);
 assert.equal((await getProductSheet('',first)).productoMaestro.id,'electric');assert.equal((await getProductSheet('',second)).productoMaestro.id,'water');
});

test('batch search slugs preserve the canonical identity of duplicate product names',async()=>{
 const {productSeoSlugIndex,seoProductSlug}=await import('../lib/domain/catalog-seo.js');
 const products=[{id:'b',nombre:'Conector rápido'},{id:'a',nombre:'Conector rápido'},{id:'c',nombre:'MDF negro 18 mm'},{id:'hidden',nombre:'MDF negro 18 mm',estado:'inactivo'}];
 const slugs=productSeoSlugIndex(products);
 for(const product of products.filter(p=>p.estado!=='inactivo'))assert.equal(slugs.get(product.id),seoProductSlug(product,products));
 assert.equal(slugs.has('hidden'),false);
});

test('collections with only test products are discoverable in pilot UI but not indexable',()=>{
 const pages=catalogLandings([[{id:'demo',nombre:'Pieza demo',categoriaId:'c',esPrueba:true}],catalog[1],[],[],[]]);
 assert.equal(pages.filter(p=>p.path!=='/repuestos').length,1);assert.ok(pages.every(p=>!p.index));
});

const automotiveCategory='cat-repuestos-automotrices';
const fitment={marcaId:'hyundai',modeloId:'accent',marcaNombre:'Hyundai',modeloNombre:'Accent',anioDesde:2015,anioHasta:2018};
const automotiveCatalog=()=>[[
 {id:'radiator',nombre:'Radiador Hyundai Accent',categoriaId:automotiveCategory,subcategoriaId:'motor',familiaId:'radiadores',compatibilidadVehiculos:[fitment]},
 {id:'mirror',nombre:'Espejo Hyundai Accent',categoriaId:automotiveCategory,subcategoriaId:'motor',familiaId:'espejos',compatibilidadVehiculos:[{...fitment,anioDesde:2019,anioHasta:2022}]},
 {id:'reference',nombre:'Pieza referencial',categoriaId:automotiveCategory,compatibilidadReferencial:true,compatibilidadVehiculos:[{...fitment,marcaId:'simulated',marcaNombre:'Simulada'}]},
 {id:'donor-only',nombre:'Pieza sin compatibilidad',categoriaId:automotiveCategory,donorVehicle:{marca:'Toyota',modelo:'Yaris'}},
 {id:'test',nombre:'Pieza demo',categoriaId:automotiveCategory,esPrueba:true,compatibilidadVehiculos:[{...fitment,modeloId:'demo',modeloNombre:'Demo'}]},
 {id:'hidden',nombre:'Pieza retirada',categoriaId:automotiveCategory,estado:'inactivo',compatibilidadVehiculos:[{...fitment,modeloId:'hidden',modeloNombre:'Hidden'}]}
],[{id:automotiveCategory,nombre:'Repuestos automotrices'}],[{id:'motor',nombre:'Motor',categoriaId:automotiveCategory}],[{id:'radiadores',nombre:'Radiadores',subcategoriaId:'motor'},{id:'espejos',nombre:'Espejos',subcategoriaId:'motor'}],[]];

test('automotive navigation uses actual master compatibility, deduplicates years, and excludes invented vehicle pages',()=>{
 const pages=catalogLandings(automotiveCatalog());
 assert.equal(pages.find(p=>p.path==='/repuestos').products.length,4);
 const model=pages.find(p=>p.path==='/vehiculos/hyundai-accent');
 assert.equal(model.products.length,2);
 assert.deepEqual(model.filters,{rubro:'repuestos',categoria:automotiveCategory,vehiculoMarcaId:'hyundai',vehiculoModeloId:'accent'});
 assert.equal(pages.filter(p=>p.path.startsWith('/vehiculos/')).length,1);
 assert.ok(pages.find(p=>p.path==='/marcas-vehiculos/hyundai'));
 assert.match(pages.find(p=>p.path==='/familias/radiadores').title,/repuestos de autos/);
 assert.ok(!pages.some(p=>/simulada|demo|hidden|toyota/.test(p.path)));
});

test('automotive pages, metadata API and sitemap share canonical URLs and legacy category redirects',async t=>{
 const catalog=automotiveCatalog();
 firestoreFixture(t,{productosMaestro:Object.fromEntries(catalog[0].map(p=>[p.id,p])),categorias:{[automotiveCategory]:catalog[1][0]},subcategorias:{motor:catalog[2][0]},familias:Object.fromEntries(catalog[3].map(f=>[f.id,f])),cachePublico:{'catalog-revision':{revision:701}}});
 const h=handler(publicPagesRouter,['/repuestos','/:kind(categorias|familias|marcas|marcas-vehiculos|vehiculos)/:slug']);
 const page=response();await h({path:'/repuestos'},page,e=>{throw e;});
 assert.equal(page.statusCode,200);assert.match(page.body,/rel="canonical" href="https:\/\/trovio.cl\/repuestos"/);
 assert.match(page.body,/href="\/vehiculos\/hyundai-accent"/);assert.doesNotMatch(page.body,/Pieza demo/);
 const model=response();await h({path:'/vehiculos/hyundai-accent'},model,e=>{throw e;});
 assert.match(model.body,/Radiador Hyundai Accent/);assert.doesNotMatch(model.body,/Pieza referencial/);
 const legacy=response();legacy.redirect=(code,url)=>{legacy.statusCode=code;legacy.location=url;return legacy;};
 await h({path:'/categorias/repuestos-automotrices'},legacy,e=>{throw e;});assert.equal(legacy.statusCode,301);assert.equal(legacy.location,'/repuestos');
 const filtered=response();filtered.redirect=(code,url)=>{filtered.statusCode=code;filtered.location=url;return filtered;};
 await h({path:'/categorias/repuestos-automotrices',originalUrl:'/categorias/repuestos-automotrices?q=radiador&ferreteriaId=local'},filtered,e=>{throw e;});assert.equal(filtered.location,'/repuestos?q=radiador&ferreteriaId=local');
 const missing=response();await h({path:'/vehiculos/toyota-yaris'},missing,e=>{throw e;});assert.equal(missing.statusCode,404);
 const api=response();await handler(publicCatalogRouter,'/catalogo-seo/:kind/:slug')({params:{kind:'repuestos',slug:'inicio'}},api,e=>{throw e;});
 assert.equal(api.body.data.path,'/repuestos');assert.equal(api.body.data.count,4);
 const sitemap=response();await handler(publicCatalogRouter,'/sitemap.xml')({},sitemap);
 assert.match(sitemap.body,/<loc>https:\/\/trovio.cl\/repuestos<\/loc>/);assert.match(sitemap.body,/\/vehiculos\/hyundai-accent/);
 assert.doesNotMatch(sitemap.body,/\/categorias\/repuestos-automotrices|\/vehiculos\/simulada|\/productos\/pieza-demo/);
});

 test('automotive entry stays available but unindexed while only reference inventory exists',()=>{
 const catalog=automotiveCatalog();catalog[0]=catalog[0].filter(p=>p.esPrueba);
 const pages=catalogLandings(catalog),root=pages.find(p=>p.path==='/repuestos');
 assert.equal(root.index,false);assert.equal(root.products.length,1);
 assert.ok(!pages.some(p=>p.path.startsWith('/vehiculos/')||p.path.startsWith('/marcas-vehiculos/')));
 assert.equal(catalogLandings([[],[],[],[],[]]).find(p=>p.path==='/repuestos').index,false);
 });
