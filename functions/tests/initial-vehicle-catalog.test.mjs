import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planInitialVehicleCatalog} from '../scripts/lib/initial-vehicle-catalog.mjs';
test('vehicle reference import preserves identities and commercial brand use and is idempotent',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../../docs/catalogo/catalogo-vehiculos-inicial.json',import.meta.url),'utf8'));
 const brands=[{id:'legacy-toyota',nombre:'Toyota',usos:['fabricante']}];const models=[{id:'legacy-corolla',marcaId:'legacy-toyota',nombre:'Corolla',activo:false}];
 const plan=planInitialVehicleCatalog(catalog,brands,models,'now');
 assert.equal(plan.references.length,13);assert.ok(plan.references.some(r=>r.modelId==='legacy-corolla'));
 assert.deepEqual(plan.updates,[{collection:'marcas',id:'legacy-toyota',data:{usos:['fabricante','vehiculo'],actualizadoEn:'now'}}]);
 assert.ok(plan.creates.every(c=>['marcas','modelosVehiculo'].includes(c.collection)));
 const nextBrands=[{...brands[0],...plan.updates[0].data},...plan.creates.filter(c=>c.collection==='marcas').map(c=>({id:c.id,...c.data}))];
 const nextModels=[...models,...plan.creates.filter(c=>c.collection==='modelosVehiculo').map(c=>({id:c.id,...c.data}))];
 const repeat=planInitialVehicleCatalog(catalog,nextBrands,nextModels,'later');assert.deepEqual(repeat.creates,[]);assert.deepEqual(repeat.updates,[]);
 assert.equal(nextModels.find(m=>m.id==='legacy-corolla').activo,false);
});
