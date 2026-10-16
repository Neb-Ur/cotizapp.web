import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRouter } from '../lib/routes/search.routes.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const handler=searchRouter.stack.find(layer=>layer.route?.path==='/productos/detalle').route.stack.at(-1).handle;
function response(){return {statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('direct slug detail returns taxonomy and only attributes from its product and family without offers',async t=>{
 const product={id:'base',nombre:'Abrazadera metálica',categoriaId:'cat',subcategoriaId:'sub',familiaId:'fam',estado:'activo'};
 firestoreFixture(t,{
  cachePublico:{meta:{dirty:false,version:'detail-fixture',updatedAt:new Date().toISOString(),policy:`data-modes-v6:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']},products:{items:[product]},offers:{items:[]},taxonomy:{categories:[{id:'cat',nombre:'Fijaciones'}],subcategories:[{id:'sub',nombre:'Amarre'}],families:[{id:'fam',nombre:'Amarres'}]}},
  productosMaestro:{base:{nombre:'Abrazadera metálica',categoriaId:'cat',subcategoriaId:'sub',familiaId:'fam',estado:'activo'}},
  categorias:{cat:{nombre:'Fijaciones'}},subcategorias:{sub:{nombre:'Amarre'}},familias:{fam:{nombre:'Amarres'}},
  atributosProductoMaestro:{right:{productoMaestroId:'base',definicionAtributoId:'material',valorTexto:'Acero'},wrong:{productoMaestroId:'other',definicionAtributoId:'foreign',valorTexto:'No corresponde'}},
  definicionesAtributoFamilia:{material:{familiaId:'fam',etiqueta:'Material'},foreign:{familiaId:'other',etiqueta:'Ajeno'}}
 });
 const res=response();await handler({query:{slug:'abrazadera-metalica'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.productoMaestro.nombre,'Abrazadera metálica');
 assert.equal(res.body.data.categoryName,'Fijaciones');assert.equal(res.body.data.subcategoryName,'Amarre');assert.equal(res.body.data.familyName,'Amarres');
 assert.deepEqual(res.body.data.stores,[]);assert.equal(res.body.data.atributosProducto.length,1);assert.equal(res.body.data.atributosProducto[0].etiqueta,'Material');
 const sheet=response();await handler({query:{slug:'abrazadera-metalica',vista:'ficha'}},sheet);
 assert.equal(sheet.body.data.productoMaestro.nombre,'Abrazadera metálica');
 assert.equal(sheet.body.data.atributosProducto[0].etiqueta,'Material');
 assert.equal(sheet.body.data.stores,undefined);assert.equal(sheet.body.data.minPrice,undefined);
 const offers=response();await handler({query:{slug:'abrazadera-metalica',vista:'ofertas'}},offers);
 assert.deepEqual(offers.body.data.stores,[]);assert.equal(offers.body.data.productoMaestro,undefined);
 assert.equal(offers.body.data.atributosProducto,undefined);
 const missing=response();await handler({query:{slug:'missing'}},missing);assert.equal(missing.statusCode,404);
});

test('product offers carry the public WhatsApp number and pilot flag through the cached API',async t=>{
 const product={id:'base',nombre:'Foco Mahindra KUV 100 2016-2020',estado:'activo'};
 const rows=[{productoMaestroId:'base',productoFerreteriaId:'offer',productName:product.nombre,storeId:'store',storeName:'Desarmaduría (Prueba)',storePhone:'private-legacy',storeWhatsappPhone:'+56991036780',storePilot:true,price:25000,stock:2}];
 firestoreFixture(t,{cachePublico:{meta:{dirty:false,version:'whatsapp-detail',updatedAt:new Date().toISOString(),policy:`data-modes-v6:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']},products:{items:[product]},offers:{items:rows},taxonomy:{categories:[],subcategories:[],families:[]}},productosMaestro:{base:product}});
 const res=response();await handler({query:{slug:'foco-mahindra-kuv-100-2016-2020',vista:'ofertas'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.stores[0].whatsappPhone,'+56991036780');assert.equal(res.body.data.stores[0].pilot,true);
});

test('dynamic detail and offer responses expose owned images with server attribution while the generic sheet stays independent',async t=>{
 const product={id:'photo-master',nombre:'Pieza con galería por local',estado:'activo',galeriaJson:['https://generic.example/catalog.webp']};
 const offerRow={productoMaestroId:product.id,productoFerreteriaId:'photo-offer',storeId:'store',storeName:'Desarmaduría Norte',price:12000,stock:1,condition:'usado'};
 const own={id:'photo',url:'https://cdn.example/own.webp',thumbnailUrl:'https://cdn.example/thumb.webp',storagePath:'private-key',uploadedBy:'private-uid'};
 firestoreFixture(t,{cachePublico:{meta:{dirty:false,version:'photo-detail',updatedAt:new Date().toISOString(),policy:`data-modes-v6:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']},products:{items:[product]},offers:{items:[offerRow]},taxonomy:{categories:[],subcategories:[],families:[]}},productosMaestro:{[product.id]:product},productosFerreteria:{'photo-offer':{productoMaestroId:product.id,ferreteriaId:'store',condicion:'usado',fotosPublicacion:[own]}}});
 for(const vista of [undefined,'ofertas']){
  const res=response();await handler({query:{producto:product.nombre.toLowerCase(),vista}},res);assert.equal(res.statusCode,200);
  assert.equal(res.body.data.storePhotos[0].storeName,'Desarmaduría Norte');assert.equal(res.body.data.storePhotos[0].condition,'usado');assert.equal(res.body.data.storePhotos[0].storagePath,undefined);assert.equal(res.body.data.storePhotos[0].uploadedBy,undefined);
  if(!vista)assert.deepEqual(res.body.data.productoMaestro.galeriaJson,product.galeriaJson);
 }
});
