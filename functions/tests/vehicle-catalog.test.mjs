import test from 'node:test';import assert from 'node:assert/strict';
import {vehicleCatalogRouter} from '../lib/routes/vehicle-catalog.routes.js';
import {masterProductsRouter} from '../lib/routes/master-products.routes.js';
import {taxonomyRouter} from '../lib/routes/taxonomy.routes.js';
import {publicCatalogRouter} from '../lib/routes/public-catalog.routes.js';
import {resolveProductBrand} from '../lib/lib/brands.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const handler=(router,path,method='get')=>router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(c){this.statusCode=c;return this;},set(){return this;},json(body){this.body=body;return this;}});
const call=async(path,body={},method='post',params={})=>{const res=response();await handler(vehicleCatalogRouter,path,method)({body,params},res);return res;};
test('vehicle uses preserve legacy brand IDs and do not enter the manufacturer options until explicitly used there',async t=>{
 const f=firestoreFixture(t,{marcas:{legacy:{nombre:'Marca antigua',nombreNormalizado:'marca antigua'}}});
 const enabled=await call('/admin/vehiculos/marcas',{marcaId:'legacy'});assert.equal(enabled.body.data.id,'legacy');
 assert.deepEqual(f.get('marcas','legacy').usos,['fabricante','vehiculo']);
 const created=await call('/admin/vehiculos/marcas',{nombre:'Marca vehículo'});const id=created.body.data.id;
 let list=response();await handler(masterProductsRouter,'/marcas')({},list);assert.deepEqual(list.body.data.map(b=>b.id),['legacy']);
 const same=await call('/admin/vehiculos/marcas',{nombre:'MARCA vehículo'});assert.equal(same.body.data.id,id);assert.equal(f.rows('marcas').length,2);
 const productBrand=await resolveProductBrand('Marca vehículo');assert.equal(productBrand.marcaId,id);assert.deepEqual(f.get('marcas',id).usos,['vehiculo','fabricante']);
 const legacy=await resolveProductBrand('MARCA ANTIGUA');assert.equal(legacy.marcaId,'legacy');assert.equal(f.rows('marcas').length,2);
});
test('models belong to a vehicle brand, deduplicate names and retain identity on edits and deactivation',async t=>{
 const f=firestoreFixture(t,{marcas:{a:{nombre:'Marca A',nombreNormalizado:'marca a',usos:['vehiculo']},b:{nombre:'Marca B',nombreNormalizado:'marca b',usos:['vehiculo']},maker:{nombre:'Fabricante',usos:['fabricante']}}});
 const invalid=await call('/admin/vehiculos/modelos',{marcaId:'maker',nombre:'Modelo'});assert.equal(invalid.statusCode,400);
 const missing=await call('/admin/vehiculos/modelos',{marcaId:'absent',nombre:'Modelo'});assert.equal(missing.statusCode,400);
 const first=await call('/admin/vehiculos/modelos',{marcaId:'a',nombre:'Modelo Uno'});const id=first.body.data.id;
 const repeated=await call('/admin/vehiculos/modelos',{marcaId:'a',nombre:'MÓDELO  UNO'});assert.equal(repeated.body.data.id,id);
 await call('/admin/vehiculos/modelos',{marcaId:'b',nombre:'Modelo Uno'});assert.equal(f.rows('modelosVehiculo').length,2);
 await call('/admin/vehiculos/modelos',{marcaId:'a',nombre:'Modelo Dos'});
 const collision=await call('/admin/vehiculos/modelos/:id',{nombre:'Modelo Dos'},'patch',{id});assert.equal(collision.statusCode,409);
 const reassigned=await call('/admin/vehiculos/modelos/:id',{marcaId:'b'},'patch',{id});assert.equal(reassigned.statusCode,400);
 const edit=await call('/admin/vehiculos/modelos/:id',{nombre:'Nombre actualizado',activo:false},'patch',{id});assert.equal(edit.body.data.id,id);assert.equal(f.get('modelosVehiculo',id).marcaId,'a');
 const recreated=await call('/admin/vehiculos/modelos',{marcaId:'a',nombre:'Modelo Uno'});assert.equal(recreated.statusCode,201);assert.notEqual(recreated.body.data.id,id);
 const publicCatalog=await call('/vehiculos/catalogo',{},'get');assert.ok(!publicCatalog.body.data.models.some(model=>model.id===id));
 const adminCatalog=await call('/admin/vehiculos/catalogo',{},'get');assert.ok(adminCatalog.body.data.models.some(model=>model.id===id&&!model.activo));
});
test('vehicle capability is explicit per family and legacy name edits retain it',async t=>{
 const f=firestoreFixture(t,{familias:{family:{nombre:'Familia',subcategoriaId:'sub'}}});
 const patch=handler(taxonomyRouter,'/familias/:id','patch');
 const invalid=response();await patch({params:{id:'family'},body:{permiteVehiculos:'false'}},invalid);assert.equal(invalid.statusCode,400);assert.equal(f.get('familias','family').permiteVehiculos,undefined);
 await patch({params:{id:'family'},body:{permiteVehiculos:true}},response());await patch({params:{id:'family'},body:{nombre:'Nuevo nombre'}},response());
 assert.equal(f.get('familias','family').permiteVehiculos,true);assert.equal(f.get('familias','family').subcategoriaId,'sub');
});
test('every administrative vehicle route rejects maestro access before its handler',async()=>{
 for(const layer of vehicleCatalogRouter.stack.filter(l=>l.route?.path.startsWith('/admin/'))){const res=response();let continued=false;await layer.route.stack[1].handle({authUserId:'master',authRole:'maestro'},res,()=>continued=true);assert.equal(res.statusCode,403);assert.equal(continued,false);}
});
test('commercial search suggestions exclude vehicle-only brands and retain legacy manufacturer labels',async t=>{
 firestoreFixture(t,{
  marcas:{legacy:{nombre:'Fabricante anterior'},dual:{nombre:'Marca compartida',usos:['fabricante','vehiculo']},vehicle:{nombre:'Solo vehículo',usos:['vehiculo']}},
  productosMaestro:{product:{nombre:'Producto anterior',marcaId:'legacy',familiaId:'family'}},
  cachePublico:{'catalog-revision':{revision:987654}}
 });
 const res=response();await handler(publicCatalogRouter,'/catalogo-busqueda')({query:{}},res);
 assert.deepEqual(res.body.data.brands.map(brand=>brand.id),['dual','legacy']);
 assert.equal(res.body.data.products[0].brand,'Fabricante anterior');
 assert.equal(res.body.data.products[0].brandId,'legacy');
});
test('vehicle catalog rejects invalid names and model state without creating references',async t=>{
 const f=firestoreFixture(t,{marcas:{brand:{nombre:'Marca',usos:['vehiculo']}}});
 for(const nombre of ['', ' '.repeat(4), '---', 'a'.repeat(121), 123, 'Sin marca']){
  const res=await call('/admin/vehiculos/marcas',{nombre});assert.equal(res.statusCode,400);
 }
 for(const nombre of ['', '---', 'a'.repeat(121), {}]){
  const res=await call('/admin/vehiculos/modelos',{marcaId:'brand',nombre});assert.equal(res.statusCode,400);
 }
 assert.equal(f.rows('marcas').length,1);assert.equal(f.rows('modelosVehiculo').length,0);
 const state=await call('/admin/vehiculos/modelos/:id',{activo:'false'},'patch',{id:'missing'});assert.equal(state.statusCode,400);
});
