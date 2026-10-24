import test from 'node:test';
import assert from 'node:assert/strict';
import { hardwareCatalog, hardwareSnapshot, isHardwareProduct, isHardwareStore } from '../lib/domain/market-scope.js';
import { mvpRouter } from '../lib/routes/mvp.routes.js';
import { publicPagesRouter } from '../lib/routes/public-pages.routes.js';
import { paginateProductSearch } from '../lib/domain/product-search.js';
import { BUSINESS_TYPES, PRODUCT_AREAS } from '../lib/domain/business-type.js';
const automotive='cat-repuestos-automotrices';
const products=[{id:'cement',nombre:'Cemento',categoriaId:'materials'},{id:'drill',nombre:'Taladro',categoriaId:'cat-herramientas-y-consumibles'},{id:'radiator',nombre:'Radiador',categoriaId:automotive},{id:'legacy',nombre:'Pieza antigua',ambitoComercial:'desarmaduria'}];
const catalog=[products,[{id:'materials',nombre:'Materiales'},{id:automotive,nombre:'Repuestos'}],[{id:'auto-sub',categoriaId:automotive}],[{id:'auto-family',subcategoriaId:'auto-sub'}],[]];
test('the active catalog, taxonomy and stale snapshots exclude automotive records without modifying stored input',()=>{
 const filtered=hardwareCatalog(catalog);
 assert.deepEqual(filtered[0].map(p=>p.id),['cement','drill']);
 assert.equal(catalog[0].length,4);assert.equal(filtered[1].length,1);assert.deepEqual(filtered[2],[]);assert.deepEqual(filtered[3],[]);
 const snapshot=hardwareSnapshot({products,searchRows:[{productoMaestroId:'cement'},{productoMaestroId:'radiator'}],taxonomy:{categories:catalog[1],subcategories:catalog[2],families:catalog[3]},version:'old'});
 assert.equal(snapshot.searchRows.length,1);assert.equal(snapshot.version,'old');
 assert.deepEqual(paginateProductSearch(snapshot,{page:1,size:20,sort:'relevance'}).items.map(p=>p.productoMaestroId).sort(),['cement','drill']);
});
test('new local and product options expose only hardware and construction',()=>{
 assert.deepEqual(BUSINESS_TYPES,['ferreteria']);assert.deepEqual(PRODUCT_AREAS,['materiales','herramientas']);
 assert.ok(isHardwareStore({}));assert.ok(isHardwareStore({tipoNegocio:'ferreteria'}));assert.equal(isHardwareStore({tipoNegocio:'desarmaduria'}),false);assert.equal(isHardwareProduct({categoriaId:automotive}),false);
});
const response=()=>({statusCode:200,headers:{},status(value){this.statusCode=value;return this;},set(k,v){this.headers[k]=v;return this;},type(){return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;}});
test('retired APIs reject old clients and no automotive router remains registered',()=>{
 const gate=mvpRouter.stack[0].handle;
 for(const path of ['/vehiculos/catalogo','/admin/vehiculos/modelos','/ferreterias/store/vehiculos-donantes','/ferreterias/store/catalogo/offer/vehiculos']){
  const res=response();gate({path,method:'GET'},res,()=>assert.fail('retired endpoint continued'));assert.equal(res.statusCode,410);
 }
 const res=response();gate({path:'/productos-maestro',method:'POST',body:{categoriaId:automotive}},res,()=>assert.fail('automotive write continued'));assert.equal(res.statusCode,400);
 let continued=false;gate({path:'/productos-maestro',method:'POST',body:{categoriaId:'materials'}},response(),()=>continued=true);assert.ok(continued);
});
test('former automotive collection URLs return 410 and noindex instead of redirecting to unrelated content',()=>{
 const retired=publicPagesRouter.stack.find(layer=>Array.isArray(layer.route?.path)&&layer.route.path.includes('/repuestos/*')).route.stack[0].handle;
 const res=response();retired({},res);assert.equal(res.statusCode,410);assert.equal(res.headers['X-Robots-Tag'],'noindex');assert.match(res.body,/materiales de construcción/);
});


test('retired public collections render HTML while retired API endpoints keep JSON in the real router order',async t=>{
 const express=(await import('express')).default;
 const app=express();app.use('/api',mvpRouter);app.use('/',mvpRouter);app.use('/',publicPagesRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/repuestos','/vehiculos/hyundai-accent','/marcas-vehiculos/hyundai']){
  const res=await fetch(base+path);assert.equal(res.status,410);assert.match(res.headers.get('content-type'),/text\/html/);assert.match(res.headers.get('x-robots-tag'),/noindex/);
 }
 const api=await fetch(base+'/api/vehiculos/catalogo');assert.equal(api.status,410);assert.match(api.headers.get('content-type'),/json/);
});
