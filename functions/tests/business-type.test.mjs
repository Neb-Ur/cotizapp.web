import test from 'node:test';
import assert from 'node:assert/strict';
import { authRouter } from '../lib/routes/auth.routes.js';
import { adminUsersRouter } from '../lib/routes/admin-users.routes.js';
import { storeDirectoryRouter } from '../lib/routes/store-directory.routes.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
import { adminAuth } from '../lib/lib/firebase.js';
const handler=(router,path,method)=>router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack.at(-1).handle;
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},set(){return this;},json(body){this.body=body;return this;}});
function seed(){
 const agreement={estado:'activo',contratoEstado:'vigente',contratoVersion:CURRENT_STORE_AGREEMENT_VERSION,contratoDocumentHash:storeAgreementDocumentHash()};
 return {usuarios:{owner:{rol:'ferreteria',nombre:'Dueño',correo:'owner@example.test',estadoCuenta:'activo',region:'Metropolitana',comuna:'Maipu'},other:{rol:'ferreteria',nombre:'Otro',correo:'other@example.test',estadoCuenta:'activo',region:'Metropolitana',comuna:'Maipu'},master:{rol:'maestro',nombre:'Maestro',correo:'master@example.test',estadoCuenta:'activo'}},ferreterias:{s:{...agreement,usuarioDuenoId:'owner',nombreComercial:'Local A'},other:{...agreement,usuarioDuenoId:'other',nombreComercial:'Local B',tipoNegocio:'repuestos'}}};
}
test('admin creates hardware stores and rejects retired business types without creating accounts',async t=>{
 const f=firestoreFixture(t);let creates=0;
 t.mock.method(adminAuth,'createUser',async()=>{creates++;return {uid:'created-owner'};});
 const post=handler(adminUsersRouter,'/admin/usuarios','post');
 const body={rol:'ferreteria',tipoNegocio:'ferreteria',password:'Test123!',nombre:'Contacto',correo:'local@example.test',ciudad:'Santiago',comuna:'Maipú',direccion:'Dirección de prueba',latitud:-33.5,longitud:-70.6};
 for(const tipoNegocio of ['invalid','repuestos','desarmaduria']){const res=response();await post({body:{...body,tipoNegocio}},res);assert.equal(res.statusCode,400);assert.equal(creates,0);}
 const res=response();await post({body},res);assert.equal(res.statusCode,201);assert.equal(f.rows('ferreterias')[0].tipoNegocio,'ferreteria');assert.equal(f.get('usuarios','created-owner').estadoCuenta,'pendiente');
});
test('owner cannot switch to a retired business type and normal profile edits preserve ownership',async t=>{
 const f=firestoreFixture(t,seed());const patch=handler(authRouter,'/auth/me','patch');
 for(const tipoNegocio of ['desarmaduria','repuestos','admin']){const res=response();await patch({authUserId:'owner',body:{tipoNegocio,nombre:'No guardar'}},res);assert.equal(res.statusCode,400);assert.equal(f.get('usuarios','owner').nombre,'Dueño');}
 const res=response();await patch({authUserId:'owner',body:{nombre:'Nuevo nombre'}},res);assert.equal(res.statusCode,200);assert.equal(f.get('ferreterias','s').usuarioDuenoId,'owner');
});
test('admin cannot enable automotive classification through a partial user update',async t=>{
 const f=firestoreFixture(t,seed());const patch=handler(adminUsersRouter,'/admin/usuarios/:id','patch');
 const res=response();await patch({params:{id:'owner'},body:{tipoNegocio:'repuestos',nombre:'No guardar'}},res);assert.equal(res.statusCode,400);assert.equal(f.get('usuarios','owner').nombre,'Dueño');
});
test('directory hides historical automotive stores and rejects retired business filters',async t=>{
 const data=seed();data.ferreterias.third={...data.ferreterias.s,tipoNegocio:'desarmaduria'};firestoreFixture(t,data);
 const list=handler(storeDirectoryRouter,'/directorio-ferreterias','get');
 const all=response();await list({query:{}},all);assert.equal(all.body.data.total,1);assert.equal(all.body.data.items[0].id,'s');
 for(const tipoNegocio of ['repuestos','desarmaduria','unknown']){const res=response();await list({query:{tipoNegocio}},res);assert.equal(res.statusCode,400);}
});
