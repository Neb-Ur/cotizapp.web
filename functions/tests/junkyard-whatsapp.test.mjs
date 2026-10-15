import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildJunkyardDocuments,planJunkyardWrites} from '../scripts/lib/junkyard-whatsapp-seed.mjs';
import {publicStore} from '../lib/services/store-directory.service.js';
const seed=JSON.parse(readFileSync(new URL('../../docs/catalogo/semilla-desarmadurias-whatsapp.json',import.meta.url)));
const products=[...new Set(seed.offers.map(o=>o.productId))].map(id=>({id,estado:'activo',esPrueba:true,categoriaId:'cat-repuestos-automotrices',compatibilidadVehiculos:[{modeloId:'kuv'}]}));
const now='2026-10-14T12:00:00.000Z';
const oldContacts=()=>new Map(seed.existingContactStoreIds.map(id=>['real_ferreterias/'+id,{esPrueba:true,tipoNegocio:'desarmaduria',estado:'activo'}]));
test('seed creates four fictional dismantlers and eighty offers, and reruns preserve edited prices',()=>{
 const docs=buildJunkyardDocuments(seed,products,now);assert.equal(docs.length,88);
 const existing=oldContacts();const first=planJunkyardWrites(seed,docs,existing,now);assert.equal(first.create.length,88);assert.equal(first.contacts.length,4);
 for(const d of docs)existing.set(d.collection+'/'+d.id,d.data);
 for(const d of first.contacts)existing.set('real_ferreterias/'+d.id,d.data);
 const offer=docs.find(d=>d.collection==='real_productosFerreteria');existing.set(offer.collection+'/'+offer.id,{...offer.data,precio:999});
 const repeat=planJunkyardWrites(seed,docs,existing,now);assert.equal(repeat.create.length,0);assert.equal(repeat.contacts.length,0);assert.equal(existing.get(offer.collection+'/'+offer.id).precio,999);
 for(const store of seed.stores){assert.equal(docs.filter(d=>d.data.ferreteriaId===store.id).length,20);assert.equal(existing.get('real_ferreterias/'+store.id).telefonoContactoPublico,seed.whatsappPhone);}
 assert.ok(docs.filter(d=>d.collection==='real_productosFerreteria').every(d=>d.data.asociacionesVehiculos.length===0));
});
test('seed rejects inactive masters, real stores and conflicting contact numbers',()=>{
 assert.throws(()=>buildJunkyardDocuments(seed,products.map(p=>({...p,estado:'inactivo'})),now),/SOURCE_INVALID/);
 const docs=buildJunkyardDocuments(seed,products,now),existing=oldContacts(),key='real_ferreterias/'+seed.existingContactStoreIds[0];
 existing.set(key,{...existing.get(key),esPrueba:false});assert.throws(()=>planJunkyardWrites(seed,docs,existing,now),/NOT_PILOT/);
 existing.set(key,{esPrueba:true,tipoNegocio:'desarmaduria',estado:'activo',telefonoContactoPublico:'+56911111111'});assert.throws(()=>planJunkyardWrites(seed,docs,existing,now),/CONTACT_CONFLICT/);
});
test('WhatsApp exposes the public store contact and never falls back to the owner private phone',()=>{
 assert.equal(publicStore({id:'s',nombreComercial:'Local'}, {telefono:'+56911111111'}).whatsappPhone,'');
 assert.equal(publicStore({id:'s',telefonoContactoPublico:seed.whatsappPhone}, {telefono:'+56911111111'}).whatsappPhone,seed.whatsappPhone);
});
