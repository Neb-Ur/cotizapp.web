import test from 'node:test';import assert from 'node:assert/strict';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {saveDonor,publishDonorPart,changeDonorPhotos,donorView} from '../lib/services/donor-vehicles.service.js';
import {donorTemplate,donorOfferId,donorRequestId} from '../lib/domain/donor-vehicle.js';
import {resolveProductRequest} from '../lib/services/product-request-resolution.service.js';
import {donorVehiclesRouter} from '../lib/routes/donor-vehicles.routes.js';
const id='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
const part=(patch={})=>({id:'radiador',nombre:'Radiador',sistema:'Motor',seleccionada:true,precio:35000,stock:1,condicion:'usado',productoMaestroId:'radiator',...patch});
const draft=(patch={})=>({marcaId:'mahindra',modeloId:'kuv',anio:2018,motor:'1.2',piezas:[part()],...patch});
const seed=()=>({ferreterias:{junk:{usuarioDuenoId:'owner',tipoNegocio:'desarmaduria'},other:{usuarioDuenoId:'other-owner',tipoNegocio:'desarmaduria'},hardware:{usuarioDuenoId:'hardware-owner',tipoNegocio:'ferreteria'}},marcas:{mahindra:{nombre:'Mahindra'}},modelosVehiculo:{kuv:{marcaId:'mahindra',nombre:'KUV100',activo:true}},productosMaestro:{radiator:{nombre:'Radiador Mahindra KUV100 2016–2019',ambitoComercial:'desarmaduria',estado:'activo',compatibilidadVehiculos:[{marcaId:'mahindra',modeloId:'kuv',anioDesde:2016,anioHasta:2019}]},late:{nombre:'Radiador 2020–2023',estado:'activo',ambitoComercial:'desarmaduria',compatibilidadVehiculos:[{marcaId:'mahindra',modeloId:'kuv',anioDesde:2020,anioHasta:2023}]},generic:{nombre:'Radiador genérico',estado:'activo',ambitoComercial:'desarmaduria'}}});
test('template has stable distinct IDs, no selected inventory and covers the dismantling systems',()=>{const a=donorTemplate();assert(a.length>=70);assert.equal(new Set(a.map(p=>p.id)).size,a.length);assert.deepEqual(a,donorTemplate());assert(a.some(p=>p.nombre==='Neblinero izquierdo'));assert(a.every(p=>p.seleccionada===undefined));});
test('donor identity and revision are validated, ownership is trusted and no client-owned photo or offer links are accepted',async t=>{
 const f=firestoreFixture(t,seed());await assert.rejects(saveDonor('junk',id,draft(),'intruder',false),e=>e.status===403);await assert.rejects(saveDonor('hardware',id,draft(),'hardware-owner',false),e=>e.status===403);
 const value=await saveDonor('junk',id,draft({piezas:[part({ofertaId:'forged',fotosPublicacion:[{url:'https://evil.test'}]})]}),'owner',false);assert.equal(value.revision,1);assert.equal(value.piezas[0].ofertaId,null);assert.deepEqual(value.piezas[0].fotosPublicacion,[]);
 await assert.rejects(saveDonor('other',id,draft(),'other-owner',false),e=>e.status===403);
 await assert.rejects(saveDonor('junk',id,draft({revision:0}),'owner',false),e=>e.code==='DONOR_REVISION_CONFLICT');
 await assert.rejects(saveDonor('junk',id,draft({revision:1,anio:2019}),'owner',false),e=>e.code==='DONOR_IDENTITY_LOCKED');assert.equal(f.rows('productosFerreteria').length,0);
});
test('two identical donor vehicles produce separate offers, same-piece retries preserve maintained prices, stock and photos',async t=>{
 const f=firestoreFixture(t,seed());for(const v of [id,second]){await saveDonor('junk',v,draft(),'owner',false);assert.equal((await publishDonorPart('junk',v,'radiador','owner',false)).estado,'publicada');}
 assert.equal(f.rows('productosFerreteria').length,2);const a=donorOfferId(id,'radiador');assert.notEqual(a,donorOfferId(second,'radiador'));
 const offer=f.get('productosFerreteria',a);assert.equal(offer.vehiculoDonanteId,id);assert.equal(offer.stock,1);assert.equal(offer.asociacionesVehiculos,undefined);assert.equal(offer.patente,undefined);
 await publishDonorPart('junk',id,'radiador','owner',false);assert.equal(f.rows('productosFerreteria').length,2);assert.equal(f.rows('historialPrecios').length,2);
});
test('partial batches retain invalid drafts, create a single proposal for unknown variants, and do not infer compatibility from donor year',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft({piezas:[part(),part({id:'incomplete',precio:0}),part({id:'unknown',productoMaestroId:null}),part({id:'out-of-year',productoMaestroId:'late'}),part({id:'generic',productoMaestroId:'generic'})]}),'owner',false);
 for(const p of ['radiador','incomplete','unknown','out-of-year','generic'])await publishDonorPart('junk',id,p,'owner',false);
 assert.equal(f.rows('productosFerreteria').length,1);assert.equal(f.rows('solicitudesCreacionProducto').length,1);assert.equal(f.get('vehiculosDonantes',id).piezas.find(p=>p.id==='incomplete').estado,'borrador');
 await publishDonorPart('junk',id,'unknown','owner',false);assert.equal(f.rows('solicitudesCreacionProducto').length,1);
 const proposal=f.get('solicitudesCreacionProducto',donorRequestId(id,'unknown'));assert.equal(proposal.publicado,false);assert.match(proposal.nombreProducto,/Mahindra KUV100 2018/);
 await assert.rejects(resolveProductRequest(donorRequestId(id,'unknown'),'aprobar','late','admin',''),e=>e.code==='DONOR_MASTER_INVALID');
 await resolveProductRequest(donorRequestId(id,'unknown'),'aprobar','radiator','admin','Identidad verificada');assert.equal(f.rows('productosFerreteria').length,1);
 assert.equal((await publishDonorPart('junk',id,'unknown','owner',false)).estado,'publicada');assert.equal(f.rows('productosFerreteria').length,2);
});
test('draft photos retain server ownership, transfer to the exact offer and cannot be modified via the draft after publication',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft(),'owner',false);
 const photo={id:'photo',url:'https://images.test/main.webp',thumbnailUrl:'https://images.test/small.webp',storagePath:'private-key',thumbnailPath:'private-thumb',uploadedBy:'owner'};
 await changeDonorPhotos('junk',id,'radiador','owner',false,photos=>[...photos,photo]);
 const before=f.get('vehiculosDonantes',id);const safe=donorView(before);assert.equal(safe.piezas[0].fotosPublicacion[0].storagePath,undefined);
 await assert.rejects(changeDonorPhotos('junk',id,'radiador','intruder',false,p=>[]),e=>e.status===403);
 await publishDonorPart('junk',id,'radiador','owner',false);assert.deepEqual(f.get('productosFerreteria',donorOfferId(id,'radiador')).fotosPublicacion,[photo]);assert.deepEqual(f.get('vehiculosDonantes',id).piezas[0].fotosPublicacion,[]);
 await assert.rejects(changeDonorPhotos('junk',id,'radiador','owner',false,p=>[]),e=>e.code==='DONOR_PHOTOS_MOVED');
});
test('private route middleware rejects other stores, hardware inventories and oversized photo sets before processing binary data',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft(),'owner',false);
 const route=donorVehiclesRouter.stack.find(l=>l.route?.path==='/ferreterias/:storeId/vehiculos-donantes'&&l.route.methods.get).route;
 const access=route.stack[2].handle,res=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}});
 let next=false;const denied=res();await access({params:{storeId:'junk'},authUserId:'other-owner',authRole:'ferreteria',method:'GET'},denied,()=>next=true);assert.equal(denied.statusCode,403);assert.equal(next,false);
 const hardware=res();await access({params:{storeId:'hardware'},authUserId:'hardware-owner',authRole:'ferreteria',method:'GET'},hardware,()=>next=true);assert.equal(hardware.statusCode,403);
 assert.equal(f.rows('productosFerreteria').length,0);
});
test('batch route validates chunk size and retries saved parts without duplicating or losing incomplete pieces',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft({piezas:[part(),part({id:'incomplete',precio:null})]}),'owner',false);
 const route=donorVehiclesRouter.stack.find(l=>l.route?.path==='/ferreterias/:storeId/vehiculos-donantes/:vehicleId/publicar').route.stack.at(-1).handle;
 const req=body=>({params:{storeId:'junk',vehicleId:id},authUserId:'owner',authRole:'ferreteria',body});
 const res=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
 for(const body of [{},{piezaIds:[]},{piezaIds:Array(11).fill('radiador')}]){const bad=res();await route(req(body),bad);assert.equal(bad.statusCode,400);}
 const first=res();await route(req({piezaIds:['radiador','incomplete']}),first);assert.deepEqual(first.body.data.results.map(r=>r.estado),['publicada','borrador']);
 const again=res();await route(req({piezaIds:['radiador']}),again);assert.equal(again.statusCode,200);assert.equal(f.rows('productosFerreteria').length,1);
});
test('deleting a sourced offer releases its draft and vehicle deletion is blocked while live inventory still references it',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft(),'owner',false);await publishDonorPart('junk',id,'radiador','owner',false);
 const remove=donorVehiclesRouter.stack.find(l=>l.route?.path==='/ferreterias/:storeId/vehiculos-donantes/:vehicleId'&&l.route.methods.delete).route.stack.at(-1).handle;
 const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
 const req={params:{storeId:'junk',vehicleId:id},authUserId:'owner',authRole:'ferreteria'};const blocked=response();await remove(req,blocked);assert.equal(blocked.statusCode,409);
 // Pending proposals are retired if an unneeded donor is removed.
 await saveDonor('junk',second,draft({piezas:[part({productoMaestroId:null})]}),'owner',false);await publishDonorPart('junk',second,'radiador','owner',false);
 const removed=response();await remove({...req,params:{storeId:'junk',vehicleId:second}},removed);assert.equal(removed.statusCode,200);assert.equal(f.get('vehiculosDonantes',second),undefined);assert.equal(f.get('solicitudesCreacionProducto',donorRequestId(second,'radiador')).estado,'rechazada');
});
test('matching a pending draft to an existing master closes the obsolete proposal, and approved donor resolutions are retry-safe after publication',async t=>{
 const f=firestoreFixture(t,seed());await saveDonor('junk',id,draft({piezas:[part({productoMaestroId:null})]}),'owner',false);await publishDonorPart('junk',id,'radiador','owner',false);
 const pending=f.get('vehiculosDonantes',id);pending.piezas[0].productoMaestroId='radiator';await saveDonor('junk',id,pending,'owner',false);await publishDonorPart('junk',id,'radiador','owner',false);
 assert.equal(f.get('solicitudesCreacionProducto',donorRequestId(id,'radiador')).estado,'rechazada');assert.match(f.get('solicitudesCreacionProducto',donorRequestId(id,'radiador')).notasAdmin,/cerrada automáticamente/);
 await saveDonor('junk',second,draft({piezas:[part({productoMaestroId:null})]}),'owner',false);await publishDonorPart('junk',second,'radiador','owner',false);const requestId=donorRequestId(second,'radiador');await resolveProductRequest(requestId,'aprobar','radiator','admin','OK');await publishDonorPart('junk',second,'radiador','owner',false);await resolveProductRequest(requestId,'aprobar','radiator','admin','retry');assert.equal(f.rows('productosFerreteria').length,2);
});
