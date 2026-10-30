import test from 'node:test';
import assert from 'node:assert/strict';
import { adminUsersRouter } from '../lib/routes/admin-users.routes.js';
import { adminAuth } from '../lib/lib/firebase.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';

const handler = (method, path) => adminUsersRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('admin rejects unsupported roles and account states before changing a profile', async t => {
  const fixture = firestoreFixture(t, { usuarios: { user: { rol: 'maestro', estadoCuenta: 'activo', nombre: 'Original' } } });
  for (const [field, value, code] of [
    ['rol', 'superadmin', 'ADMIN_INVALID_ROLE'],
    ['rol', null, 'ADMIN_INVALID_ROLE'],
    ['estadoCuenta', 'deshabilitado', 'ADMIN_INVALID_ACCOUNT_STATUS'],
    ['estadoCuenta', null, 'ADMIN_INVALID_ACCOUNT_STATUS']
  ]) {
    const res = response();
    await handler('patch', '/admin/usuarios/:id')({ params: { id: 'user' }, body: { nombre: 'No guardar', [field]: value } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, code);
    assert.deepEqual(fixture.get('usuarios', 'user'), { rol: 'maestro', estadoCuenta: 'activo', nombre: 'Original' });
  }
});

test('admin rejects unsupported initial account states without creating a Firebase identity', async t => {
  firestoreFixture(t);
  let calls = 0;
  t.mock.method(adminAuth, 'createUser', async () => { calls += 1; return { uid: 'new-user' }; });
  const res = response();
  await handler('post', '/admin/usuarios')({ body: { rol: 'maestro', nombre: 'Usuario', correo: 'user@example.test', password: 'Abcd12!', estadoCuenta: 'invalid' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'ADMIN_INVALID_ACCOUNT_STATUS');
  assert.equal(calls, 0);
});

test('admin creation preserves the exact validated password, including surrounding spaces', async t => {
  firestoreFixture(t);
  let suppliedPassword;
  t.mock.method(adminAuth, 'createUser', async payload => { suppliedPassword = payload.password; return { uid: 'new-user' }; });
  const password = ' Ab1! ';
  const res = response();
  await handler('post', '/admin/usuarios')({ body: { rol: 'maestro', nombre: 'Usuario', correo: 'user@example.test', password } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(suppliedPassword, password);
});

test('admin can still update supported roles and account states', async t => {
  const fixture = firestoreFixture(t, { usuarios: { user: { rol: 'maestro', estadoCuenta: 'activo' } } });
  const res = response();
  await handler('patch', '/admin/usuarios/:id')({ params: { id: 'user' }, body: { rol: 'admin', estadoCuenta: 'pendiente' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.get('usuarios', 'user').rol, 'admin');
  assert.equal(fixture.get('usuarios', 'user').estadoCuenta, 'pendiente');
});
