import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRouter } from '../lib/routes/search.routes.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const handler=searchRouter.stack.find(layer=>layer.route?.path==='/productos/detalle').route.stack.at(-1).handle;
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('direct slug detail returns taxonomy and only attributes from its product and family without offers',async t=>{
 const product={id:'base',nombre:'Abrazadera metálica',categoriaId:'cat',subcategoriaId:'sub',familiaId:'fam',estado:'activo'};
 firestoreFixture(t,{
  cachePublico:{meta:{dirty:false,version:'detail-fixture',updatedAt:new Date().toISOString(),policy:`data-modes-v1:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']},products:{items:[product]},offers:{items:[]},taxonomy:{categories:[{id:'cat',nombre:'Fijaciones'}],subcategories:[{id:'sub',nombre:'Amarre'}],families:[{id:'fam',nombre:'Amarres'}]}},
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
