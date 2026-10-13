import test from 'node:test';
import assert from 'node:assert/strict';
import {offerVehiclesRouter} from '../lib/routes/offer-vehicles.routes.js';
import {storeCatalogRouter} from '../lib/routes/store-catalog.routes.js';
import {normalizeVehicleApplications,vehicleApplicationsEnabled} from '../lib/domain/vehicle-application.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
const path='/ferreterias/:storeId/catalogo/:offerId/vehiculos';
const handler=(router,p,method)=>router.stack.find(l=>l.route?.path===p&&l.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const application=(marcaId='a',modeloId='model-a',anioDesde=2000,anioHasta=2004)=>({marcaId,modeloId,anioDesde,anioHasta});
function setup(t){
 const prior=[process.env.VEHICLE_APPLICATIONS_ENABLED,process.env.VEHICLE_APPLICATION_PILOT_STORE_IDS];
 process.env.VEHICLE_APPLICATIONS_ENABLED='true';process.env.VEHICLE_APPLICATION_PILOT_STORE_IDS='store';
 t.after(()=>['VEHICLE_APPLICATIONS_ENABLED','VEHICLE_APPLICATION_PILOT_STORE_IDS'].forEach((key,i)=>{if(prior[i]===undefined)delete process.env[key];else process.env[key]=prior[i];}));
 return firestoreFixture(t,{ferreterias:{store:{usuarioDuenoId:'owner'}},contratosFerreteria:{agreement:{ferreteriaId:'store',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash(),estado:'vigente'}},productosMaestro:{product:{nombre:'Pieza',familiaId:'family'}},familias:{family:{permiteVehiculos:true}},productosFerreteria:{offer:{ferreteriaId:'store',productoMaestroId:'product',precio:1500,stock:2,condicion:'usado'}},marcas:{a:{nombre:'Marca A',usos:['vehiculo']},b:{nombre:'Marca B',usos:['vehiculo']}},modelosVehiculo:{'model-a':{nombre:'Modelo A',marcaId:'a',activo:true},'model-b':{nombre:'Modelo B',marcaId:'b',activo:true}}});
}
async function call(method='put',applications=[],authUserId='owner',params={storeId:'store',offerId:'offer'}){
 const res=response();await handler(offerVehiclesRouter,path,method)({params,authUserId,authRole:'ferreteria',body:{asociacionesVehiculos:applications}},res);return res;
}
test('manual associations retain full tuples and server-resolved names; legacy edits preserve declarations',async t=>{
 const f=setup(t);const declarations=[application(),application('b','model-b',2010,2012)];
 const res=await call('put',declarations);assert.equal(res.statusCode,200);
 assert.equal(res.body.data.applications[0].marcaNombre,'Marca A');assert.equal(res.body.data.applications[1].modeloId,'model-b');
 await call('put',declarations);assert.equal(f.get('productosFerreteria','offer').asociacionesVehiculos.length,2);
 const edit=response();await handler(storeCatalogRouter,'/ferreterias/:storeId/catalogo/:offerId','patch')({authUserId:'owner',authRole:'ferreteria',params:{storeId:'store',offerId:'offer'},body:{precio:1700}},edit);
 assert.equal(f.get('productosFerreteria','offer').asociacionesVehiculos.length,2);assert.equal(f.get('productosFerreteria','offer').stock,2);
 assert.equal(f.rows('historialPrecios').length,3);
});
test('mismatched brands, inactive new models and disabled families cannot alter an offer',async t=>{
 const f=setup(t);assert.equal((await call('put',[application('b','model-a')])).statusCode,400);
 const model={...f.get('modelosVehiculo','model-a'),activo:false};
 const {db}=await import('../lib/lib/firebase.js');await db.collection('modelosVehiculo').doc('model-a').update(model);
 assert.equal((await call('put',[application()])).statusCode,400);
 await db.collection('familias').doc('family').update({permiteVehiculos:false});assert.equal((await call('put',[application('b','model-b')])).statusCode,400);
 assert.equal(f.get('productosFerreteria','offer').asociacionesVehiculos,undefined);assert.equal(f.rows('historialPrecios').length,0);
});
test('ownership, pilot allowlist and publication identity are enforced; disabling preserves reads',async t=>{
 const f=setup(t);assert.equal((await call('put',[application()],'other')).statusCode,403);
 assert.equal((await call('put',[application()],'owner',{storeId:'store',offerId:'missing'})).statusCode,404);
 await call('put',[application()]);process.env.VEHICLE_APPLICATIONS_ENABLED='false';assert.equal((await call('put',[])).statusCode,403);
 const read=await call('get');assert.equal(read.statusCode,200);assert.equal(read.body.data.canEdit,false);assert.equal(read.body.data.applications.length,1);
 process.env.VEHICLE_APPLICATIONS_ENABLED='true';process.env.VEHICLE_APPLICATION_PILOT_STORE_IDS='another-store';assert.equal(vehicleApplicationsEnabled('store'),false);assert.equal((await call('put',[])).statusCode,403);
 assert.equal(f.get('productosFerreteria','offer').precio,1500);
});
test('unknown years are explicit; invalid intervals, duplicates and overlaps are rejected',()=>{
 assert.deepEqual(normalizeVehicleApplications([application('a','model-a',null,null)]),[application('a','model-a',null,null)]);
 for(const pair of [[2000,null],[2004,2000],[2000.5,2001],['2000',2001],[1800,1900],[2000,2101]])assert.throws(()=>normalizeVehicleApplications([application('a','model-a',...pair)]));
 assert.throws(()=>normalizeVehicleApplications([application(),application()]));
 assert.throws(()=>normalizeVehicleApplications([application(),application('a','model-a',2004,2008)]));
 assert.throws(()=>normalizeVehicleApplications([application(),application('a','model-a',null,null)]));
 assert.equal(normalizeVehicleApplications([application(),application('a','model-a',2005,2008)]).length,2);
 assert.throws(()=>normalizeVehicleApplications(Array(21).fill(application())));assert.throws(()=>normalizeVehicleApplications(null));
});
test('deactivated models retain previously declared ranges and association removal is explicit',async t=>{
 const f=setup(t);await call('put',[application()]);const {db}=await import('../lib/lib/firebase.js');await db.collection('modelosVehiculo').doc('model-a').update({activo:false});
 assert.equal((await call('put',[application()])).statusCode,200);assert.equal((await call('put',[application('a','model-a',2005,2008)])).statusCode,400);
 await db.collection('familias').doc('family').update({permiteVehiculos:false});assert.equal((await call('put',[])).statusCode,200);assert.deepEqual(f.get('productosFerreteria','offer').asociacionesVehiculos,[]);
});
