import test from 'node:test';
import assert from 'node:assert/strict';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
import { db } from '../lib/lib/firebase.js';
import { COLLECTIONS } from '../lib/lib/collections.js';
import { searchRouter } from '../lib/routes/search.routes.js';

test('rebuilt public detail preserves image disclosure without exposing editorial metadata', async t => {
  firestoreFixture(t, {
    productosMaestro: { reference: {
      nombre: 'Alternador automotriz', estado: 'activo',
      origenImagen: 'ai_generated', imagenReferencial: true,
      imagenPrincipalUrl: '/alternador.webp', proveedorImagen: 'private editorial metadata'
    } }
  });
  // Cache cleanup is irrelevant to this boundary test; no expired artifacts exist.
  const collection = db.collection.bind(db);
  t.mock.method(db, 'collection', name => {
    const ref = collection(name);
    if (name === COLLECTIONS.publicCache) {
      const where = ref.where.bind(ref);
      ref.where = (field, op, value) => op === '<'
        ? { limit: () => ({ get: async () => ({ docs: [] }) }) }
        : where(field, op, value);
    }
    return ref;
  });
  const handler = searchRouter.stack.find(layer => layer.route?.path === '/productos/detalle').route.stack.at(-1).handle;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ query: { producto: 'Alternador automotriz' } }, res);
  assert.equal(res.statusCode, 200);
  const product = res.body.data.productoMaestro;
  assert.equal(product.imagenReferencial, true);
  assert.equal(product.origenImagen, 'ai_generated');
  assert.equal(product.proveedorImagen, undefined);
  assert.deepEqual(res.body.data.stores, []);
});
