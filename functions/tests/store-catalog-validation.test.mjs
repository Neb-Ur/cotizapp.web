import test from 'node:test';
import assert from 'node:assert/strict';
import {storeCatalogRouter} from '../lib/routes/store-catalog.routes.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
const handler=method=>storeCatalogRouter.stack.find(layer=>layer.route?.path===(method==='post'?'/ferreterias/:storeId/catalogo':'/ferreterias/:storeId/catalogo/:offerId')&&layer.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=body=>({authRole:'ferreteria',authUserId:'owner',params:{storeId:'store',offerId:'offer'},body});
const seed=offer=>({
 ferreterias:{store:{usuarioDuenoId:'owner',tipoNegocio:'ferreteria',estado:'activo'}},
 productosMaestro:{cement:{nombre:'Cemento',categoriaId:'materials',estado:'activo'}},
 productosFerreteria:offer?{offer:{ferreteriaId:'store',productoMaestroId:'cement',precio:5000,stock:20,activo:true,publicado:true}}:{},
 contratosFerreteria:{agreement:{ferreteriaId:'store',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash(),estado:'vigente'}}
});
for(const method of ['post','patch']){
 test(`catalog ${method} rejects invalid prices and stock without changing offers or history`,async t=>{
  const fixture=firestoreFixture(t,seed(method==='patch'));
  const before=fixture.rows('productosFerreteria');
  const badPrices=[-500,0,'sin precio',null,'',false,{},Infinity];
  const badStocks=[-1,1.5,'sin stock',null,'',false,{},Infinity,Number.MAX_SAFE_INTEGER+1];
  for(const [field,values] of [['precio',badPrices],['stock',badStocks]])for(const value of values){
   const res=response();await handler(method)(request({productoMaestroId:'cement',precio:5000,stock:20,[field]:value}),res);
   assert.equal(res.statusCode,400,`${method} ${field} ${JSON.stringify(value)}`);
   assert.deepEqual(fixture.rows('productosFerreteria'),before);assert.equal(fixture.rows('historialPrecios').length,0);
  }
 });
 test(`catalog ${method} accepts numeric strings and zero stock`,async t=>{
  const fixture=firestoreFixture(t,seed(method==='patch')),res=response();
  await handler(method)(request({productoMaestroId:'cement',precio:'5490.5',stock:'0'}),res);
  assert.equal(res.statusCode,method==='post'?201:200);
  const [offer]=fixture.rows('productosFerreteria');assert.equal(offer.precio,5490.5);assert.equal(offer.stock,0);
 });
}
test('metadata-only updates preserve existing price and stock',async t=>{
 const fixture=firestoreFixture(t,seed(true)),res=response();await handler('patch')(request({publicado:false}),res);
 assert.equal(res.statusCode,200);const offer=fixture.get('productosFerreteria','offer');assert.equal(offer.precio,5000);assert.equal(offer.stock,20);assert.equal(offer.publicado,false);
});
