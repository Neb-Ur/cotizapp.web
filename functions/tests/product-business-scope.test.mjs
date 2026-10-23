import test from 'node:test';import assert from 'node:assert/strict';
import {productMatchesBusinessType,normalizeProductBusinessScope} from '../lib/domain/business-type.js';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {storeCatalogRouter} from '../lib/routes/store-catalog.routes.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(router,path,method='get')=>router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const seed=()=>({
 productosMaestro:{hardware:{nombre:'A Cemento',categoriaId:'construction',ambitoComercial:'ferreteria',estado:'activo'},car:{nombre:'B Radiador',categoriaId:'cat-repuestos-automotrices',ambitoComercial:'desarmaduria',estado:'activo'},shared:{nombre:'C Llave',categoriaId:'cat-herramientas-y-consumibles',ambitoComercial:'ambos',estado:'activo'}},
 ferreterias:{junk:{usuarioDuenoId:'owner',tipoNegocio:'desarmaduria'},hardware:{usuarioDuenoId:'other',tipoNegocio:'ferreteria'}},
 contratosFerreteria:{a:{ferreteriaId:'junk',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash(),estado:'vigente'}},
 productosFerreteria:{wrong:{ferreteriaId:'junk',productoMaestroId:'hardware',precio:1000,stock:2},valid:{ferreteriaId:'junk',productoMaestroId:'car',precio:2000,stock:1}}
});
test('product area controls eligibility and tools are shared across local types',()=>{
 assert.equal(productMatchesBusinessType({ambitoComercial:'ferreteria',categoriaId:'cat-repuestos-automotrices'},'desarmaduria'),true);
 for(const type of ['ferreteria','desarmaduria','repuestos'])assert.equal(productMatchesBusinessType({ambitoComercial:'ambos',categoriaId:'cat-herramientas-y-consumibles'},type),true);
 assert.equal(normalizeProductBusinessScope(undefined,'cat-repuestos-automotrices'),'desarmaduria');assert.equal(normalizeProductBusinessScope(undefined,'materials'),'ferreteria');
});
test('available products use the actual owned store even when the browser sends the other business type',async t=>{
 firestoreFixture(t,seed());const list=handler(masterProductsRouter,'/ferreterias/:storeId/productos-disponibles');
 const req=(storeId,uid,query={})=>({params:{storeId},authUserId:uid,authRole:'ferreteria',query});
 const res=response();await list(req('junk','owner',{tipoNegocio:'ferreteria',size:'1',page:'2'}),res);assert.equal(res.body.data.total,2);assert.equal(res.body.data.items[0].id,'shared');assert.deepEqual(new Set(res.body.data.categoryIds),new Set(['cat-repuestos-automotrices','cat-herramientas-y-consumibles']));
 const denied=response();await list(req('hardware','owner'),denied);assert.equal(denied.statusCode,403);
 const hardware=response();await list(req('hardware','other'),hardware);assert.deepEqual(hardware.body.data.items.map(p=>p.id),['hardware','shared']);
});
test('own catalog hides incompatible legacy offers without deleting them and prevents direct additions outside scope',async t=>{
 const f=firestoreFixture(t,seed());const get=handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo');const req={params:{storeId:'junk'},authUserId:'owner',authRole:'ferreteria'};
 const list=response();await get(req,list);assert.deepEqual(list.body.data.map(o=>o.id),['valid']);assert(f.get('productosFerreteria','wrong'));
 const admin=response();await get({...req,authRole:'admin'},admin);assert.equal(admin.body.data.length,2);
 const post=handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo','post');
 const invalid=response();await post({...req,body:{productoMaestroId:'hardware',ambitoComercial:'ambos',precio:1000,stock:1}},invalid);assert.equal(invalid.statusCode,400);
 const shared=response();await post({...req,body:{productoMaestroId:'shared',precio:1000,stock:1}},shared);assert.equal(shared.statusCode,201);
 const patch=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch')({...req,params:{storeId:'junk',offerId:'wrong'},body:{stock:10}},patch);assert.equal(patch.statusCode,400);
});
test('admin master writes reject invalid product classifications before changing the catalog',async t=>{
 const f=firestoreFixture(t,seed());const create=response();await handler(masterProductsRouter,'/productos-maestro','post')({authUserId:'admin',body:{ambitoComercial:'todo'}},create);assert.equal(create.statusCode,400);
 const patch=response();await handler(masterProductsRouter,'/productos-maestro/:id','patch')({params:{id:'car'},authUserId:'admin',body:{ambitoComercial:'todo'}},patch);assert.equal(patch.statusCode,400);assert.equal(f.get('productosMaestro','car').ambitoComercial,'desarmaduria');
});

test('real stores cannot select or directly link simulated master products',async t=>{
 const data=seed();data.productosMaestro.simulated={nombre:'D Herramienta simulada',categoriaId:'cat-herramientas-y-consumibles',ambitoComercial:'ambos',estado:'activo',esPrueba:true};
 const f=firestoreFixture(t,data);
 const req={params:{storeId:'junk'},authUserId:'owner',authRole:'ferreteria',query:{}};
 const list=response();await handler(masterProductsRouter,'/ferreterias/:storeId/productos-disponibles')(req,list);
 assert.equal(list.body.data.items.some(p=>p.id==='simulated'),false);
 const denied=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo','post')({...req,body:{productoMaestroId:'simulated',precio:1000,stock:1}},denied);
 assert.equal(denied.statusCode,400);assert.equal(denied.body.error.code,'TEST_PRODUCT_NOT_ALLOWED');
 assert.equal(f.rows('productosFerreteria').length,2);
});
