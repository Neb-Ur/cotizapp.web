import test from 'node:test';
import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {storeCatalogRouter} from '../lib/routes/store-catalog.routes.js';
import {intellectualPropertyRouter} from '../lib/routes/intellectual-property.routes.js';
import {resolveProductRequest} from '../lib/services/product-request-resolution.service.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
import {db} from '../lib/lib/firebase.js';
import {COLLECTIONS} from '../lib/lib/collections.js';
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

for(const moderation of [
 {propiedadIntelectualEstado:'retiro_preventivo',propiedadIntelectualEstadoAnterior:{activo:true,publicado:true}},
 {propiedadIntelectualEstado:'retiro_definitivo'},
 {propiedadIntelectualEstado:'esperando_respuesta',propiedadIntelectualEstadoAnterior:{activo:true,publicado:true}}
])test(`store owners cannot republish withdrawn offers: ${moderation.propiedadIntelectualEstado}`,async t=>{
 const input=seed();
 input.productosFerreteria={withdrawn:{ferreteriaId:'store',productoMaestroId:'radiator',stock:1,precio:10000,activo:false,publicado:false,...moderation}};
 const fixture=firestoreFixture(t,input),patch=handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch');
 const request=body=>({authUserId:'owner',authRole:'ferreteria',params:{storeId:'store',offerId:'withdrawn'},body});
 for(const body of [{activo:true},{publicado:true},{activo:true,publicado:true},{activo:'true',publicado:1}]){
  const denied=response();await patch(request(body),denied);
  assert.equal(denied.statusCode,403);assert.equal(denied.body.error.code,'OFFER_MODERATION_RESTRICTED');
  assert.equal(fixture.get('productosFerreteria','withdrawn').activo,false);
  assert.equal(fixture.get('productosFerreteria','withdrawn').publicado,false);
 }
 const edited=response();await patch(request({precio:12000,activo:false,publicado:false}),edited);
 assert.equal(edited.statusCode,200);assert.equal(fixture.get('productosFerreteria','withdrawn').precio,12000);
});

test('administrative moderation restoration unlocks normal owner publication changes',async t=>{
 const input=seed();
 input.productosFerreteria={withdrawn:{ferreteriaId:'store',productoMaestroId:'radiator',stock:1,precio:10000,activo:false,publicado:false,propiedadIntelectualEstado:'retiro_preventivo',propiedadIntelectualEstadoAnterior:{activo:true,publicado:true}}};
 input.denunciasPropiedadIntelectual={report:{targetType:'store_offer',targetId:'withdrawn'}};
 const fixture=firestoreFixture(t,input),restored=response();
 await handler(intellectualPropertyRouter,'/admin/ip-reports/:id','patch')({authUserId:'admin',authRole:'admin',params:{id:'report'},body:{status:'repuesto',resolution:'Revisión documentada',publicStatusMessage:'Publicación restablecida'}},restored);
 assert.equal(restored.statusCode,200);assert.equal(fixture.get('productosFerreteria','withdrawn').propiedadIntelectualEstadoAnterior,null);
 const edited=response();
 await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch')({authUserId:'owner',authRole:'ferreteria',params:{storeId:'store',offerId:'withdrawn'},body:{activo:true,publicado:true}},edited);
 assert.equal(edited.statusCode,200);assert.equal(fixture.get('productosFerreteria','withdrawn').publicado,true);
});

test('a concurrent moderation withdrawal cannot be overwritten by an owner save already in progress',async t=>{
 const input=seed();
 input.productosFerreteria={offer:{ferreteriaId:'store',productoMaestroId:'radiator',precio:10000,stock:1,activo:true,publicado:true}};
 const fixture=firestoreFixture(t,input),collection=db.collection.bind(db);
 let withdrawn=false;
 t.mock.method(db,'collection',name=>{
  const table=collection(name);
  if(name!==COLLECTIONS.storeProducts)return table;
  return {...table,doc(id){
   const ref=table.doc(id);
   return {...ref,async get(){
    const snapshot=await ref.get();
    const value=snapshot.data();
    if(!withdrawn){
     withdrawn=true;
     await ref.update({activo:false,publicado:false,propiedadIntelectualEstado:'retiro_preventivo',propiedadIntelectualEstadoAnterior:{activo:true,publicado:true}});
    }
    return {...snapshot,data:()=>value};
   }};
  }};
 });
 const denied=response();
 await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch')({authUserId:'owner',authRole:'ferreteria',params:{storeId:'store',offerId:'offer'},body:{activo:true,publicado:true}},denied);
 assert.equal(withdrawn,true);assert.equal(denied.statusCode,403);
 assert.equal(denied.body.error.code,'OFFER_MODERATION_RESTRICTED');
 assert.equal(fixture.get('productosFerreteria','offer').publicado,false);
 assert.equal(fixture.get('productosFerreteria','offer').activo,false);
});
