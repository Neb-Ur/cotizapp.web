import test from 'node:test';
import assert from 'node:assert/strict';
import {brandIdentity} from '../lib/domain/brand-identity.js';
import {resolveProductBrand} from '../lib/lib/brands.js';
import {paginateProductSearch} from '../lib/domain/product-search.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
test('brand identity deduplicates accents, case and spacing, but excludes generic labels',()=>{
 assert.equal(brandIdentity('  ÁRAUCO ').id,brandIdentity('arauco').id);
 assert.equal(brandIdentity('Black  Decker').id,brandIdentity('BLACK DECKER').id);
 for(const name of ['',null,'Sin marca','Genérico','Por especificar'])assert.equal(brandIdentity(name),null);
 assert.notEqual(brandIdentity('Bosch').id,brandIdentity('Makita').id);
});
test('saving products reuses one canonical brand and leaves base products without a brand identity',async t=>{
 const fixture=firestoreFixture(t);
 const first=await resolveProductBrand('Arauco');
 const second=await resolveProductBrand('ÁRAUCO');
 assert.deepEqual(second,first);assert.equal(fixture.rows('marcas').length,1);
 assert.deepEqual(await resolveProductBrand('Por especificar'),{marca:'Por especificar',marcaId:null});
});
test('stable brand filtering includes legacy products and takes precedence over the display label',()=>{
 const brandId=brandIdentity('Arauco').id;
 const snapshot={version:'v',taxonomy:{categories:[],subcategories:[],families:[]},searchRows:[],products:[{id:'1',nombre:'Tablero',marca:'ÁRAUCO'},{id:'2',nombre:'Tablero 18',marca:'Arauco',marcaId:brandId},{id:'3',nombre:'Otro tablero',marca:'Bosch'}]};
 const result=paginateProductSearch(snapshot,{page:1,size:20,sort:'relevance',brandId,brand:'Old display name'});
 assert.equal(result.total,2);
});

test('product create and edit persist a canonical brand reference, and clearing it removes the reference',async t=>{
 const {masterProductsRouter}=await import('../lib/routes/master-products.routes.js');
 const fixture=firestoreFixture(t);
 const handler=(method,path)=>masterProductsRouter.stack.find(layer=>layer.route?.path===path && layer.route.methods[method]).route.stack.at(-1).handle;
 const response=()=>({status(){return this;},json(body){this.body=body;return this;}});
 const res=response();
 await handler('post','/productos-maestro')({body:{nombre:'Taladro',marca:'Bosch',origenContenido:'original',referenciaDerechosContenido:'Ficha original'},authUserId:'admin'},res);
 assert.equal(res.body.ok,true);
 const product=res.body.data;
 assert.equal(product.marcaId,brandIdentity('Bosch').id);
 const edited=response();
 await handler('patch','/productos-maestro/:id')({params:{id:product.id},body:{marca:'BOSCH'},authUserId:'admin'},edited);
 assert.equal(edited.body.data.marca,'Bosch');assert.equal(fixture.rows('marcas').length,1);
 const cleared=response();
 await handler('patch','/productos-maestro/:id')({params:{id:product.id},body:{marca:'Sin marca'},authUserId:'admin'},cleared);
 assert.equal(cleared.body.data.marcaId,null);
});

test('brands are shared with the master catalog instead of being isolated with store offers',async()=>{
 const {collectionForMode}=await import('../lib/lib/data-mode.js');
 assert.equal(collectionForMode('marcas'),'marcas');
 assert.equal(collectionForMode('productosMaestro'),'productosMaestro');
 assert.equal(collectionForMode('productosFerreteria'),'real_productosFerreteria');
});
