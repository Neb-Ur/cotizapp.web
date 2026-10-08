import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogLandings, productSeoDescription } from '../lib/domain/catalog-seo.js';
import { brandIdentity } from '../lib/domain/brand-identity.js';
import { publicCatalogRouter } from '../lib/routes/public-catalog.routes.js';
import { publicPagesRouter } from '../lib/routes/public-pages.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const brand=brandIdentity('Stanley');
const products=[{id:'tool',nombre:'Destornillador Stanley',categoriaId:'c',subcategoriaId:'s',familiaId:'f',marcaId:brand.id,marca:'Stanley'},{id:'off',nombre:'Inactivo',estado:'inactivo',familiaId:'f'}];
const catalog=[products,[{id:'c',nombre:'Herramientas'}],[{id:'s',nombre:'Manuales',categoriaId:'c'}],[{id:'f',nombre:'Destornilladores',subcategoriaId:'s'},{id:'empty',nombre:'Vacía'}],[brand,{id:'generic',nombre:'Por especificar'}]];
function response(){return {statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},type(){return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;}};}
function handler(router,path){return router.stack.find(l=>JSON.stringify(l.route?.path)===JSON.stringify(path)).route.stack.at(-1).handle;}
test('landing pages include only published products and useful families/brands',()=>{
 const pages=catalogLandings(catalog);assert.equal(pages.length,3);
 assert.equal(pages.find(p=>p.path==='/familias/destornilladores').filters.categoria,'c');
 assert.equal(pages.find(p=>p.path==='/marcas/stanley').products.length,1);
 assert.ok(!productSeoDescription(products[0]).includes('0 ferreterías'));
});
test('sitemap includes base products with no offers; collection HTML has crawlable links, canonical and real missing-page status',async t=>{
 firestoreFixture(t,{productosMaestro:Object.fromEntries(products.map(p=>[p.id,p])),categorias:{c:catalog[1][0]},subcategorias:{s:catalog[2][0]},familias:{f:catalog[3][0],empty:catalog[3][1]},marcas:{[brand.id]:brand},cachePublico:{'catalog-revision':{revision:99}}});
 const map=response();await handler(publicCatalogRouter,'/sitemap.xml')({},map);assert.match(map.body,/\/productos\/destornillador-stanley/);assert.match(map.body,/\/familias\/destornilladores/);assert.match(map.body,/\/marcas\/stanley/);assert.doesNotMatch(map.body,/inactivo|vacia|<lastmod>/);
 const h=handler(publicPagesRouter,['/:kind(categorias|familias|marcas)/:slug']);
 const page=response();await h({path:'/familias/destornilladores'},page,e=>{throw e;});assert.equal(page.statusCode,200);assert.match(page.body,/<h1>Destornilladores<\/h1>/);assert.match(page.body,/href="\/productos\/destornillador-stanley"/);assert.match(page.body,/CollectionPage/);assert.match(page.body,/rel="canonical" href="https:\/\/cotizapp-d71c8.web.app\/familias\/destornilladores"/);
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
