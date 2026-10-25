import test from 'node:test';import assert from 'node:assert/strict';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(method,path)=>masterProductsRouter.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;}});
test('technical review preserves catalog content, rejects stale or invented measurements, and only lists hardware products',async t=>{
 const f=firestoreFixture(t,{productosMaestro:{p:{nombre:'Pintura blanca',estado:'activo',unidadVenta:'Envase',descripcionLarga:'Descripción vigente'},old:{nombre:'Retirado',ambitoComercial:'desarmaduria'}}});
 const list=response();await handler('get','/admin/catalogo/calidad')({},list);assert.equal(list.body.data.length,1);assert.equal(list.body.data[0].specs,null);
 const put=handler('put','/admin/catalogo/:id/calculo');const req={authUserId:'admin',authRole:'admin',params:{id:'p'},body:{reviewedAt:null,specs:{saleUnit:'envase',litersPerPackage:4,paintCoverage:10,source:'Fabricante, ficha de este envase'}}};
 const saved=response();await put(req,saved);assert.equal(saved.statusCode,200);assert.equal(f.get('productosMaestro','p').descripcionLarga,'Descripción vigente');assert.equal(f.get('productosMaestro','p').calculationSpecsReviewedBy,'admin');
 const stale=response();await put(req,stale);assert.equal(stale.statusCode,409);
 const invalid=response();await put({...req,body:{specs:{saleUnit:'envase',paintCoverage:-1,source:'Fabricante'}}},invalid);assert.equal(invalid.statusCode,400);assert.equal(f.get('productosMaestro','p').calculationSpecs.paintCoverage,10);
 const removed=response();await put({...req,body:{specs:null,reviewedAt:saved.body.data.calculationSpecsReviewedAt}},removed);assert.equal(removed.statusCode,200);assert.equal(f.get('productosMaestro','p').calculationSpecs,null);
});
