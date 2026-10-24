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
test('retired local types cannot publish any active product area',()=>{
 for(const type of ['desarmaduria','repuestos'])for(const categoriaId of ['construction','cat-herramientas-y-consumibles','cat-repuestos-automotrices'])assert.equal(productMatchesBusinessType({categoriaId},type),false);
 assert.equal(productMatchesBusinessType({categoriaId:'construction'},'ferreteria'),true);
});
test('retired stores cannot request available products by forging a hardware query',async t=>{
 firestoreFixture(t,seed());const list=handler(masterProductsRouter,'/ferreterias/:storeId/productos-disponibles');
 const res=response();await list({params:{storeId:'junk'},authUserId:'owner',authRole:'ferreteria',query:{tipoNegocio:'ferreteria'}},res);assert.equal(res.statusCode,400);
 const normal=response();await list({params:{storeId:'hardware'},authUserId:'other',authRole:'ferreteria',query:{}},normal);assert.deepEqual(normal.body.data.items.map(p=>p.id),['hardware','shared']);
});
test('historical automotive offers stay stored but are absent from the active local catalog',async t=>{
 const f=firestoreFixture(t,seed());const list=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo')({params:{storeId:'junk'},authUserId:'owner',authRole:'ferreteria'},list);
 assert.deepEqual(list.body.data,[]);assert.equal(f.rows('productosFerreteria').length,2);
});
test('real hardware stores cannot directly link simulated products',async t=>{
 const data=seed();data.contratosFerreteria.b={...data.contratosFerreteria.a,ferreteriaId:'hardware'};data.productosMaestro.simulated={nombre:'Herramienta simulada',categoriaId:'cat-herramientas-y-consumibles',estado:'activo',esPrueba:true};firestoreFixture(t,data);
 const denied=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo','post')({params:{storeId:'hardware'},authUserId:'other',authRole:'ferreteria',body:{productoMaestroId:'simulated',precio:1000,stock:1}},denied);assert.equal(denied.statusCode,400);assert.equal(denied.body.error.code,'TEST_PRODUCT_NOT_ALLOWED');
});
