import test from 'node:test';
import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {storeCatalogRouter} from '../lib/routes/store-catalog.routes.js';
import {resolveProductRequest} from '../lib/services/product-request-resolution.service.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
const handler=(router,path,method)=>router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const seed=()=>({productosMaestro:{cement:{nombre:'A Cemento',categoriaId:'materials',estado:'activo'},tool:{nombre:'B Taladro',categoriaId:'tools',estado:'activo'},radiator:{nombre:'Radiador Mahindra KUV100 2016–2019',categoriaId:'cat-repuestos-automotrices',estado:'activo'},light:{nombre:'Neblinero Mahindra KUV100 2020–2023',categoriaId:'cat-repuestos-automotrices',estado:'activo'},draft:{nombre:'Borrador',categoriaId:'cat-repuestos-automotrices',estado:'inactivo'}},ferreterias:{store:{usuarioDuenoId:'owner',tipoNegocio:'desarmaduria',estado:'activo'}},contratosFerreteria:{agreement:{ferreteriaId:'store',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash(),estado:'vigente'}}});
test('business scope is applied before pagination, totals, text search and category filters',async t=>{
 firestoreFixture(t,seed());const list=handler(masterProductsRouter,'/productos-maestro/paginado','get');
 for(const tipoNegocio of ['desarmaduria','repuestos','ferreteria']){
  const res=response();await list({query:{tipoNegocio,size:'1',page:'1'}},res);
  assert.equal(res.body.data.total,2);assert.equal(res.body.data.totalPages,2);assert.equal(res.body.data.items.length,1);
  assert.equal(res.body.data.items[0].categoriaId==='cat-repuestos-automotrices',tipoNegocio!=='ferreteria');
 }
 for(const query of [{tipoNegocio:'desarmaduria',query:'Cemento'},{tipoNegocio:'ferreteria',query:'Mahindra'},{tipoNegocio:'desarmaduria',categoriaId:'tools'}]){const res=response();await list({query},res);assert.equal(res.body.data.total,0);}
 const excluded=response();await list({query:{tipoNegocio:'desarmaduria',excludeProductoMaestroIds:'light'}},excluded);assert.equal(excluded.body.data.total,1);assert.equal(excluded.body.data.items[0].id,'radiator');
 const invalid=response();await list({query:{tipoNegocio:'admin'}},invalid);assert.equal(invalid.statusCode,400);
 const global=response();await list({query:{}},global);assert.equal(global.body.data.total,4);
 const importList=response();await handler(masterProductsRouter,'/productos-maestro','get')({query:{tipoNegocio:'desarmaduria'}},importList);assert.equal(importList.body.data.length,2);assert.ok(importList.body.data.every(p=>p.categoriaId==='cat-repuestos-automotrices'));
});
test('direct creation cannot bypass the actual store business type with client supplied classification',async t=>{
 const fixture=firestoreFixture(t,seed());const post=handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo','post');
 const request=productoMaestroId=>({params:{storeId:'store'},authUserId:'owner',authRole:'ferreteria',body:{productoMaestroId,precio:10000,stock:2,tipoNegocio:'ferreteria'}});
 const rejected=response();await post(request('cement'),rejected);assert.equal(rejected.statusCode,400);assert.equal(rejected.body.error.code,'STORE_PRODUCT_BUSINESS_TYPE_MISMATCH');assert.equal(fixture.rows('productosFerreteria').length,0);
 const created=response();await post(request('radiator'),created);assert.equal(created.statusCode,201);
});
test('hardware stores cannot add automotive masters and request approvals obey the same scope',async t=>{
 const data=seed();data.ferreterias.store.tipoNegocio='ferreteria';data.solicitudesCreacionProducto={request:{estado:'pendiente',ferreteriaId:'store',precioReferencia:10000,cantidadReferencia:1}};
 const fixture=firestoreFixture(t,data);
 const res=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo','post')({params:{storeId:'store'},authUserId:'owner',authRole:'ferreteria',body:{productoMaestroId:'radiator',precio:10000,stock:1}},res);assert.equal(res.statusCode,400);
 await assert.rejects(resolveProductRequest('request','aprobar','radiator','admin',''),e=>e.code==='STORE_PRODUCT_BUSINESS_TYPE_MISMATCH');
 assert.equal(fixture.rows('productosFerreteria').length,0);assert.equal(fixture.get('solicitudesCreacionProducto','request').estado,'pendiente');
});

test('a sourced vehicle offer rejects stock above one through direct catalog maintenance',async t=>{
 const input=seed();input.productosFerreteria={sourced:{ferreteriaId:'store',productoMaestroId:'radiator',vehiculoDonanteId:'vehicle',piezaDonanteId:'radiator',stock:1,precio:10000,publicado:true}};
 const fixture=firestoreFixture(t,input),patch=handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch');
 const req={authUserId:'owner',authRole:'ferreteria',params:{storeId:'store',offerId:'sourced'},body:{stock:2}};
 const denied=response();await patch(req,denied);assert.equal(denied.statusCode,400);assert.equal(denied.body.error.code,'DONOR_STOCK_INVALID');assert.equal(fixture.get('productosFerreteria','sourced').stock,1);
 const sold=response();await patch({...req,body:{stock:0}},sold);assert.equal(sold.statusCode,200);assert.equal(fixture.get('productosFerreteria','sourced').stock,0);
});
