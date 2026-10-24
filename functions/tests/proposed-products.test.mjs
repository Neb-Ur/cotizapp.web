import test from 'node:test';
import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {publishProposedProduct} from '../lib/services/proposed-product.service.js';
import {resolveProductRequest} from '../lib/services/product-request-resolution.service.js';
const seed=()=>({ferreterias:{hardware:{tipoNegocio:'ferreteria'},junk:{tipoNegocio:'desarmaduria'},test:{tipoNegocio:'ferreteria',esPrueba:true}}});
const draft=(area,patch={})=>({name:'Taladro percutor X',area,price:25000,stock:3,...patch});
test('a proposed tool is public immediately and review does not duplicate or overwrite the offer',async t=>{
 const f=firestoreFixture(t,seed());const result=await publishProposedProduct('hardware','owner',draft('herramientas'));
 assert.equal(result.estado,'pendiente');assert.equal(result.publicado,true);
 const master=f.get('productosMaestro',result.productoMaestroSugeridoId),offer=f.get('productosFerreteria',result.productoFerreteriaId);
 assert.equal(master.categoriaId,'cat-herramientas-y-consumibles');assert.equal(master.estado,'activo');assert.equal(master.validacionPendiente,true);
 assert.equal(offer.precio,25000);assert.equal(offer.publicado,true);
 await publishProposedProduct('hardware','owner',draft('herramientas',{price:100}));assert.equal(f.rows('productosFerreteria').length,1);assert.equal(f.rows('solicitudesCreacionProducto').length,1);assert.equal(f.get('productosFerreteria',result.productoFerreteriaId).precio,25000);
 await resolveProductRequest(result.id,'aprobar',master.id||result.productoMaestroSugeridoId,'admin','OK');
 assert.equal(f.get('productosMaestro',result.productoMaestroSugeridoId).validacionPendiente,false);assert.equal(f.rows('productosFerreteria').length,1);
});
test('invalid local/type combinations and cross-type taxonomy fail without creating any products',async t=>{
 const f=firestoreFixture(t,seed());
 for(const [store,area] of [['hardware','repuestos'],['junk','materiales'],['junk','invalid']]) await assert.rejects(publishProposedProduct(store,'owner',draft(area)),e=>e.code==='PRODUCT_AREA_INVALID');
 assert.equal(f.rows('productosMaestro').length,0);assert.equal(f.rows('productosFerreteria').length,0);
});
test('rejection removes the provisional offer from public results without deleting its data',async t=>{
 const f=firestoreFixture(t,seed());const result=await publishProposedProduct('hardware','owner',draft('materiales',{name:'Moldura de madera'}));
 await resolveProductRequest(result.id,'rechazar','','admin','Ficha incorrecta');
 assert.equal(f.get('productosFerreteria',result.productoFerreteriaId).publicado,false);
 assert.equal(f.get('productosFerreteria',result.productoFerreteriaId).stock,3);
});
test('test proposals never hide a later real proposal with the same identity',async t=>{
 const f=firestoreFixture(t,seed());const simulated=await publishProposedProduct('test','owner',draft('herramientas'));const real=await publishProposedProduct('hardware','owner',draft('herramientas'));
 assert.notEqual(simulated.productoMaestroSugeridoId,real.productoMaestroSugeridoId);
 assert.equal(f.get('productosMaestro',real.productoMaestroSugeridoId).esPrueba,false);
});

test('retry after rejection returns a conflict instead of claiming an unpublished offer is public',async t=>{
 firestoreFixture(t,seed());const result=await publishProposedProduct('hardware','owner',draft('herramientas'));
 await resolveProductRequest(result.id,'rechazar','','admin','No válido');
 await assert.rejects(publishProposedProduct('hardware','owner',draft('herramientas')),e=>e.code==='PROPOSAL_NOT_PUBLISHED');
});

test('retry after deleting its offer never reports a phantom publication',async t=>{
 firestoreFixture(t,seed());const result=await publishProposedProduct('hardware','owner',draft('herramientas'));
 const {db}=await import('../lib/lib/firebase.js');const {COLLECTIONS}=await import('../lib/lib/collections.js');
 await db.collection(COLLECTIONS.storeProducts).doc(result.productoFerreteriaId).delete();
 await assert.rejects(publishProposedProduct('hardware','owner',draft('herramientas')),e=>e.code==='PROPOSAL_NOT_PUBLISHED');
});

test('a stale proposal cannot bypass a product type changed by administration',async t=>{
 firestoreFixture(t,seed());const result=await publishProposedProduct('hardware','owner',draft('herramientas'));
 const {db}=await import('../lib/lib/firebase.js');const {COLLECTIONS}=await import('../lib/lib/collections.js');
 await db.collection(COLLECTIONS.masterProducts).doc(result.productoMaestroSugeridoId).update({nombre:'Material reclasificado',categoriaId:'cat-materiales-por-clasificar',subcategoriaId:'sub-materiales',familiaId:'fam-materiales'});
 await assert.rejects(publishProposedProduct('hardware','owner',draft('herramientas')),e=>e.code==='PRODUCT_AREA_MISMATCH');
});
