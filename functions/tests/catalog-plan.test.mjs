import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalogDocuments, classifyCatalogDocuments } from '../scripts/lib/catalog-plan.mjs';
import { masterProductsRouter } from '../lib/routes/master-products.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const plan = JSON.parse(await readFile(new URL('../../docs/catalogo/inventario-propuesto.json', import.meta.url), 'utf8'));
const timestamp = '2026-10-05T12:00:00.000Z';
const handler = (method, path) => masterProductsRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
function response() { return { statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;} }; }

test('the catalog maps every proposed type to an active base master with no photos or invented offers', () => {
 const docs = buildCatalogDocuments(plan, timestamp);
 const products = docs.filter(doc => doc.collection === 'productosMaestro');
 assert.equal(products.length,816);
 assert.equal(docs.filter(doc => doc.collection === 'familias').length,101);
 assert.equal(new Set(docs.map(doc => `${doc.collection}/${doc.id}`)).size,docs.length);
 for(const {data} of products){assert.equal(data.estado,'activo');assert.equal(data.catalogoNivel,'tipo_base');assert.equal(data.imagenPrincipalUrl,'');assert.deepEqual(data.galeriaJson,[]);assert.equal(data.precio,undefined);assert.equal(data.stock,undefined);}
 assert.ok(docs.every(doc => !/usuarios|ferreterias|productosFerreteria/.test(doc.collection)));
 const defs=docs.filter(doc=>doc.collection==='definicionesAtributoFamilia' && doc.data.codigo==='tipo_producto');
 assert.equal(defs.length,101);assert.equal(defs.reduce((sum,doc)=>sum+doc.data.opcionesJson.length,0),816);
});
test('a repeated import preserves reviewed records and rejects taxonomy collisions', () => {
 const docs=buildCatalogDocuments(plan,timestamp);
 const existing=new Map(docs.map(doc=>[`${doc.collection}/${doc.id}`,{...doc.data}]));
 const product=docs.find(doc=>doc.collection==='productosMaestro');
 existing.set(`${product.collection}/${product.id}`,{...product.data,nombre:'Producto revisado',estado:'activo'});
 const repeat=classifyCatalogDocuments(docs,existing);assert.equal(repeat.create.length,0);assert.equal(repeat.conflicts.length,0);assert.equal(repeat.skipped.length,docs.length);
 existing.set(`categorias/${plan.categories[0].id}`,{nombre:'Otra categoría'});
 assert.equal(classifyCatalogDocuments(docs,existing).conflicts.length,1);
});
test('invalid catalog relationships and duplicate IDs fail before any write', () => {
 const bad=structuredClone(plan);bad.productTypes[0].familyId='missing';assert.throws(()=>buildCatalogDocuments(bad,timestamp),/inválido/);
 const duplicate=structuredClone(plan);duplicate.categories.push(duplicate.categories[0]);assert.throws(()=>buildCatalogDocuments(duplicate,timestamp),/duplicado/);
});
test('public lists and details hide drafts while the administrator can review them', async t => {
 firestoreFixture(t,{productosMaestro:{draft:{nombre:'Cemento',estado:'inactivo'},live:{nombre:'Cemento 25 kg',estado:'activo'}}});
 const req={query:{},params:{id:'draft'}};
 const publicList=response();await handler('get','/productos-maestro/paginado')(req,publicList);assert.equal(publicList.body.data.total,1);
 const adminList=response();await handler('get','/admin/productos-maestro/paginado')({...req,authRole:'admin'},adminList);assert.equal(adminList.body.data.total,2);
 const hidden=response();await handler('get','/productos-maestro/:id')(req,hidden);assert.equal(hidden.statusCode,404);
 const visible=response();await handler('get','/admin/productos-maestro/:id')({...req,authRole:'admin'},visible);assert.equal(visible.statusCode,200);
 const route=masterProductsRouter.stack.find(layer=>layer.route?.path==='/admin/productos-maestro/paginado').route;
 assert.equal(route.stack.length,3); // Authentication and admin authorization before the handler.
});
test('an active base can remain generic without a fabricated commercial identity', async t => {
 firestoreFixture(t,{productosMaestro:{base:{nombre:'Cemento',tipoProducto:'Cemento',marca:'Por especificar',catalogoNivel:'tipo_base',estado:'activo',origenContenido:'original',referenciaDerechosContenido:'Inventario editorial propio'}}});
 const res=response();await handler('patch','/productos-maestro/:id')({params:{id:'base'},body:{estado:'activo'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.estado,'activo');assert.equal(res.body.data.catalogoNivel,'tipo_base');
});

test('MDF variants use one family with required color, finish and dimensions, rather than color categories', () => {
 const docs=buildCatalogDocuments(plan,timestamp);
 const mdf=docs.find(doc=>doc.collection==='familias' && doc.id==='fam-mdf');assert.equal(mdf.data.nombre,'MDF');
 const fields=docs.filter(doc=>doc.collection==='definicionesAtributoFamilia' && doc.data.familiaId==='fam-mdf');
 for(const code of ['color','acabado','espesor_mm','largo_mm','ancho_mm']) assert.equal(fields.find(doc=>doc.data.codigo===code)?.data.esObligatorio,true);
 for(const code of ['espesor_mm','ancho_mm','largo_mm']) assert.equal(fields.find(doc=>doc.data.codigo===code).data.tipoDato,'numero');
 assert.ok(!docs.some(doc=>['categorias','subcategorias','familias'].includes(doc.collection) && /MDF negro|MDF rojo/i.test(doc.data.nombre)));
 const base=docs.find(doc=>doc.collection==='atributosProductoMaestro' && doc.data.productoMaestroId==='base-fam-mdf--tablero-mdf-desnudo');assert.equal(base.data.valorOpcion,'Tablero MDF desnudo');
});
