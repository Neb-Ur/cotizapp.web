import test from 'node:test';
import assert from 'node:assert/strict';
import { publicCatalogRouter } from '../lib/routes/public-catalog.routes.js';
import { paginateProductSearch } from '../lib/domain/product-search.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const handler=publicCatalogRouter.stack.find(layer=>layer.route?.path==='/catalogo-busqueda').route.stack.at(-1).handle;
const response=()=>({set(){return this;},json(body){this.body=body;return this;}});
test('search index excludes inactive products, prices and internal records and reuses its content version',async t=>{
 firestoreFixture(t,{productosMaestro:{one:{nombre:'MDF 18 mm negro',marca:'Árauco',tipoProducto:'MDF',categoriaId:'c',subcategoriaId:'s',familiaId:'f',estado:'activo',secret:'Internal'},hidden:{nombre:'Oculto',estado:'inactivo'}},categorias:{c:{nombre:'Maderas'}},subcategorias:{s:{nombre:'Tableros',categoriaId:'c'}},familias:{f:{nombre:'MDF',subcategoriaId:'s'}}});
 const first=response();await handler({query:{}},first);
 assert.equal(first.body.data.products.length,1);assert.equal(first.body.data.products[0].name,'MDF 18 mm negro');
 assert.equal(first.body.data.products[0].secret,undefined);assert.equal(first.body.data.stores,undefined);
 const next=response();await handler({query:{v:first.body.data.version}},next);
 assert.deepEqual(next.body.data,{version:first.body.data.version,unchanged:true});
});
test('full results support taxonomy text, accents, reordered units and exact brand filtering',()=>{
 const snapshot={version:'v',taxonomy:{categories:[{id:'c',nombre:'Maderas'}],subcategories:[],families:[{id:'f',nombre:'Tableros MDF'}]},products:[{id:'1',nombre:'MDF 18 mm negro',marca:'Árauco',categoriaId:'c',familiaId:'f',estado:'activo'}],searchRows:[]};
 const options={page:1,size:20,sort:'relevance'};
 for(const query of ['negro mdf 18mm','arauco','maderas']) assert.equal(paginateProductSearch(snapshot,{...options,query}).total,1);
 assert.equal(paginateProductSearch(snapshot,{...options,brand:'otra'}).total,0);
 assert.equal(paginateProductSearch(snapshot,{...options,brand:'Arauco'}).total,1);
});
