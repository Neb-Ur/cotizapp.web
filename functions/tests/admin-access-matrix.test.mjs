import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mvpRouter } from '../lib/routes/mvp.routes.js';
import { adminAuth } from '../lib/lib/firebase.js';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/lib/legal.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';

function privilegedRoutes(router) {
  return router.stack.flatMap(layer => {
    if (!layer.route) return layer.handle.stack ? privilegedRoutes(layer.handle) : [];
    const path = layer.route.path;
    return Object.keys(layer.route.methods).filter(method => path.startsWith('/admin/')
      || path.startsWith('/solicitudes-creacion-producto')
      || (method !== 'get' && /^\/(?:categorias|subcategorias|familias|productos-maestro)(?:\/|$)/.test(path)))
      .map(method => ({ method, path: path.replace(/:[A-Za-z]+/g, 'fixture') }));
  });
}

test('all administrative routes reject visitors and authenticated customer/store roles over HTTP', async t => {
  const legal = { estadoCuenta: 'activo', terminosVersion: CURRENT_TERMS_VERSION, privacidadVersion: CURRENT_PRIVACY_VERSION, mayoriaEdadDeclarada: true };
  const fixture = firestoreFixture(t, { usuarios: { maestro: { ...legal, rol: 'maestro' }, ferreteria: { ...legal, rol: 'ferreteria' } } });
  t.mock.method(adminAuth, 'verifyIdToken', async (token, checkRevoked) => { assert.equal(checkRevoked, true); return { uid: token }; });
  const app = express();
  app.use(express.json());
  app.use('/api', mvpRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = `http://127.0.0.1:${server.address().port}`;
  const routes = privilegedRoutes(mvpRouter);
  assert.ok(routes.length > 30, 'expected coverage across all administrative modules');
  for (const route of routes) {
    for (const role of [null, 'maestro', 'ferreteria']) {
      const res = await fetch(`${address}/api${route.path}`, { method: route.method.toUpperCase(), headers: role ? { Authorization: `Bearer ${role}` } : {} });
      const body = await res.json();
      assert.equal(res.status, role ? 403 : 401, `${route.method} ${route.path}, role=${role}`);
      assert.equal(body.error.code, role ? 'AUTH_FORBIDDEN' : 'AUTH_REQUIRED', `${route.method} ${route.path}, role=${role}`);
    }
  }
  assert.deepEqual(fixture.rows('productosMaestro'), []);
  assert.deepEqual(fixture.rows('categorias'), []);
  assert.equal(fixture.rows('usuarios').length, 2);
});
