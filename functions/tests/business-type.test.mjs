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
test('admin creation records a business subtype while keeping the existing pending store role',async t=>{
 const f=firestoreFixture(t);let creates=0;
 t.mock.method(adminAuth,'createUser',async()=>{creates++;return {uid:'created-owner'};});
 const post=handler(adminUsersRouter,'/admin/usuarios','post');
 const body={rol:'ferreteria',tipoNegocio:'desarmaduria',password:'Test123!',nombre:'Contacto',correo:'local@example.test',ciudad:'Santiago',comuna:'Maipú',direccion:'Dirección de prueba',latitud:-33.5,longitud:-70.6};
 const invalid=response();await post({body:{...body,tipoNegocio:'invalid'}},invalid);assert.equal(invalid.statusCode,400);assert.equal(creates,0);
 const res=response();await post({body},res);assert.equal(res.statusCode,201);
 assert.equal(f.get('usuarios','created-owner').rol,'ferreteria');assert.equal(f.get('usuarios','created-owner').estadoCuenta,'pendiente');
 assert.equal(f.rows('ferreterias')[0].tipoNegocio,'desarmaduria');assert.equal(res.body.data.tipoNegocio,'desarmaduria');
});
test('owner changes only their business classification and legacy edits preserve it',async t=>{
 const f=firestoreFixture(t,seed());const patch=handler(authRouter,'/auth/me','patch');
 const req=body=>({authUserId:'owner',body});const res=response();await patch(req({tipoNegocio:'desarmaduria'}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.data.tipoNegocio,'desarmaduria');
 assert.equal(f.get('usuarios','owner').rol,'ferreteria');assert.equal(f.get('ferreterias','other').tipoNegocio,'repuestos');
 assert.equal(f.get('ferreterias','s').contratoEstado,'vigente');
 await patch(req({nombre:'Nuevo nombre'}),response());assert.equal(f.get('ferreterias','s').tipoNegocio,'desarmaduria');
 const invalid=response();await patch(req({tipoNegocio:'admin',nombre:'No guardar'}),invalid);assert.equal(invalid.statusCode,400);assert.equal(f.get('usuarios','owner').nombre,'Nuevo nombre');
 const master=response();await patch({authUserId:'master',body:{tipoNegocio:'repuestos'}},master);assert.equal(master.statusCode,400);
});
test('admin classification edit is atomic and does not create or change roles',async t=>{
 const f=firestoreFixture(t,seed());const patch=handler(adminUsersRouter,'/admin/usuarios/:id','patch');
 const req=body=>({params:{id:'owner'},body});await patch(req({tipoNegocio:'repuestos',nombre:'Contacto actualizado'}),response());
 assert.equal(f.get('ferreterias','s').tipoNegocio,'repuestos');assert.equal(f.get('usuarios','owner').rol,'ferreteria');
 const res=response();await patch(req({tipoNegocio:'otro',nombre:'No guardar'}),res);assert.equal(res.statusCode,400);assert.equal(f.get('usuarios','owner').nombre,'Contacto actualizado');
});
test('directory combines business type and location before pagination, retaining all legacy stores without the filter',async t=>{
 const data=seed();data.ferreterias.third={...data.ferreterias.s,tipoNegocio:'desarmaduria'};firestoreFixture(t,data);
 const list=handler(storeDirectoryRouter,'/directorio-ferreterias','get');
 const all=response();await list({query:{}},all);assert.equal(all.body.data.total,3);assert.equal(all.body.data.items.find(s=>s.id==='s').businessType,'ferreteria');
 const filtered=response();await list({query:{tipoNegocio:'repuestos',region:'metropolitana',comuna:'maipu',page:'5',size:'1'}},filtered);
 assert.equal(filtered.body.data.total,1);assert.equal(filtered.body.data.page,1);assert.equal(filtered.body.data.items[0].id,'other');
 const none=response();await list({query:{tipoNegocio:'repuestos',comuna:'otra'}},none);assert.equal(none.body.data.total,0);
 const invalid=response();await list({query:{tipoNegocio:'unknown'}},invalid);assert.equal(invalid.statusCode,400);
});
