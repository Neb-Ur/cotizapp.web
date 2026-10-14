import test from 'node:test';import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
const post=masterProductsRouter.stack.find(l=>l.route?.path==='/productos-maestro'&&l.route.methods.post).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
function fixture(t){return firestoreFixture(t,{familias:{radiators:{permiteVehiculos:true}},marcas:{mahindra:{nombre:'Mahindra',usos:['vehiculo']}},modelosVehiculo:{kuv:{nombre:'KUV100',marcaId:'mahindra',activo:true}}});}
const body=()=>({nombre:'Client supplied generic name',nombrePieza:'Radiador',categoriaId:'cat-repuestos-automotrices',subcategoriaId:'sub',familiaId:'radiators',marca:'Bosch',origenContenido:'original',referenciaDerechosContenido:'Own verified description',compatibilidadVehiculos:[{marcaId:'mahindra',modeloId:'kuv',marcaNombre:'wrong',modeloNombre:'wrong',anioDesde:2016,anioHasta:2019}]});
test('admin creation resolves vehicle names, keeps manufacturer separate and rejects duplicate variants',async t=>{
 const f=fixture(t);const res=response();await post({body:body(),authUserId:'admin'},res);
 assert.equal(res.statusCode,201);assert.equal(res.body.data.nombre,'Radiador Mahindra KUV100 2016–2019');assert.equal(res.body.data.marca,'Bosch');assert.equal(res.body.data.catalogoNivel,'producto_comercial');
 const duplicate=response();await post({body:body(),authUserId:'admin'},duplicate);assert.equal(duplicate.statusCode,409);assert.equal(f.rows('productosMaestro').length,1);
});
test('incomplete years, mismatched models and missing master compatibility are rejected before creating products',async t=>{
 const f=fixture(t);
 for(const change of [{compatibilidadVehiculos:[]},{compatibilidadVehiculos:[{...body().compatibilidadVehiculos[0],anioDesde:null,anioHasta:null}]},{compatibilidadVehiculos:[{...body().compatibilidadVehiculos[0],modeloId:'missing'}]}]){const res=response();await post({body:{...body(),...change},authUserId:'admin'},res);assert.equal(res.statusCode,400);}
 assert.equal(f.rows('productosMaestro').length,0);
});

test('changing vehicle years on a variant with published offers requires a new master',async t=>{
 const f=fixture(t);const created=response();await post({body:body(),authUserId:'admin'},created);
 const {db}=await import('../lib/lib/firebase.js');const {COLLECTIONS}=await import('../lib/lib/collections.js');
 await db.collection(COLLECTIONS.storeProducts).doc('linked').set({productoMaestroId:created.body.data.id,activo:true,publicado:true});
 const patch=masterProductsRouter.stack.find(l=>l.route?.path==='/productos-maestro/:id'&&l.route.methods.patch).route.stack.at(-1).handle;
 const res=response();await patch({params:{id:created.body.data.id},body:{compatibilidadVehiculos:[{...body().compatibilidadVehiculos[0],anioHasta:2021}]},authUserId:'admin'},res);
 assert.equal(res.statusCode,409);assert.match(res.body.error.message,/nueva ficha/);assert.equal(f.rows('productosMaestro')[0].compatibilidadVehiculos[0].anioHasta,2019);
});
