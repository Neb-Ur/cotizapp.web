import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { storeDirectoryRouter } from '../lib/routes/store-directory.routes.js';
import { requireAuth } from '../lib/lib/auth.js';
import { adminAuth } from '../lib/lib/firebase.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const handler = (path,method='get') => storeDirectoryRouter.stack.find(layer=>layer.route?.path===path && layer.route.methods[method]).route.stack.at(-1).handle;
const response = () => ({statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
function seed(count=14){
 const users={owner:{rol:'ferreteria',estadoCuenta:'activo',correo:'public@example.test',terminosVersion:CURRENT_TERMS_VERSION,privacidadVersion:CURRENT_PRIVACY_VERSION,mayoriaEdadDeclarada:true},master:{rol:'maestro',nombre:'Ana Pérez',estadoCuenta:'activo',terminosVersion:CURRENT_TERMS_VERSION,privacidadVersion:CURRENT_PRIVACY_VERSION,mayoriaEdadDeclarada:true}};
 const ferreterias=Object.fromEntries(Array.from({length:count},(_,i)=>[`s${i}`,{usuarioDuenoId:'owner',nombreComercial:`Local ${String(i).padStart(2,'0')}`,estado:'activo',region:'Metropolitana',comuna:i%2?'Maipú':'Ñuñoa',contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()}]));
 ferreterias.hidden={...ferreterias.s0,estado:'inactivo'};
 return {usuarios:users,ferreterias};
}

test('directory paginates and filters by location, includes stores without offers and exposes no account fields', async t=>{
 firestoreFixture(t,seed());
 const list=handler('/directorio-ferreterias');
 const first=response();await list({query:{}},first);
 assert.equal(first.body.data.total,14);assert.equal(first.body.data.items.length,12);assert.equal(first.body.data.totalPages,2);
 const second=response();await list({query:{page:'2'}},second);
 assert.equal(second.body.data.items.length,2);
 assert.equal(new Set([...first.body.data.items,...second.body.data.items].map(x=>x.id)).size,14);
 assert.equal(first.body.data.items[0].rating,null);
 assert.ok(!JSON.stringify(first.body.data).includes('usuarioDuenoId'));
 const filtered=response();await list({query:{comuna:'nunoa',region:'metropolitana'}},filtered);assert.equal(filtered.body.data.total,7);
 const invalid=response();await list({query:{size:'10000'}},invalid);assert.equal(invalid.statusCode,400);
});

test('reviews use the authenticated maestro, replace their own entry and return public scores without UID', async t=>{
 const fixture=firestoreFixture(t,seed(1));
 const put=handler('/directorio-ferreterias/:storeId/mi-resena','put');
 const req={params:{storeId:'s0'},authUserId:'master',body:{rating:5,comment:'Muy buena atención',userId:'owner',authorName:'Nombre inventado'}};
 const created=response();await put(req,created);
 assert.equal(created.body.data.authorName,'Ana');assert.equal(created.body.data.userId,undefined);
 assert.equal(fixture.rows('resenasFerreteria')[0].userId,'master');
 const updated=response();await put({...req,body:{rating:3,comment:'Cambió mi experiencia'}},updated);
 assert.equal(fixture.rows('resenasFerreteria').length,1);assert.equal(updated.body.data.createdAt,created.body.data.createdAt);
 const detail=response();await handler('/directorio-ferreterias/:storeId')({params:{storeId:'s0'},query:{}},detail);
 assert.equal(detail.body.data.store.rating,3);assert.equal(detail.body.data.store.reviewCount,1);
 assert.equal(detail.body.data.reviews[0].userId,undefined);
 await handler('/directorio-ferreterias/:storeId/mi-resena','delete')({params:{storeId:'s0'},authUserId:'another'},response());
 assert.equal(fixture.rows('resenasFerreteria').length,1);
 await handler('/directorio-ferreterias/:storeId/mi-resena','delete')(req,response());
 assert.equal(fixture.rows('resenasFerreteria').length,0);
});

test('rejects invalid ratings, oversized/empty comments and unavailable stores',async t=>{
 firestoreFixture(t,seed(1));const put=handler('/directorio-ferreterias/:storeId/mi-resena','put');
 for(const body of [{rating:0,comment:'Correcto'},{rating:6,comment:'Correcto'},{rating:2.5,comment:'Correcto'},{rating:'5',comment:'Correcto'},{rating:4,comment:'   '},{rating:4,comment:'a'.repeat(1501)}]){
  const res=response();await put({params:{storeId:'s0'},authUserId:'master',body},res);assert.equal(res.statusCode,400);
 }
 const hidden=response();await put({params:{storeId:'hidden'},authUserId:'master',body:{rating:4,comment:'Correcto'}},hidden);assert.equal(hidden.statusCode,404);
});

test('review writes require authentication and maestro role through the real middleware', async t=>{
 firestoreFixture(t,seed(1));
 t.mock.method(adminAuth,'verifyIdToken',async token=>({uid:token==='maestro'?'master':'owner'}));
 const app=express();app.use(express.json());app.use(storeDirectoryRouter);
 const server=app.listen(0);t.after(()=>server.close());await new Promise(resolve=>server.once('listening',resolve));
 const url=`http://127.0.0.1:${server.address().port}/directorio-ferreterias/s0/mi-resena`;
 const body=JSON.stringify({rating:5,comment:'Buen servicio'});
 assert.equal((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body})).status,401);
 const noRole=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body});
 assert.equal(noRole.status,403);
 assert.equal((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer maestro'},body})).status,200);
 for(const layer of storeDirectoryRouter.stack.filter(layer=>layer.route?.path.endsWith('mi-resena'))){assert.ok(layer.route.stack.some(item=>item.handle===requireAuth));}
});
