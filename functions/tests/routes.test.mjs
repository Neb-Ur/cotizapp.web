import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mvpRouter } from '../lib/routes/mvp.routes.js';
import { requireAuth, requireRole } from '../lib/lib/auth.js';
import { canAccessOwner } from '../lib/lib/ownership.js';
import { normalizeProjectProximity, coordinateValue, geographicDistanceKm } from '../lib/lib/values.js';
import { normalizeItems } from '../lib/services/quotation.service.js';

const baseline = JSON.parse(readFileSync(new URL('./route-contracts.json', import.meta.url), 'utf8'));
function contracts(router) {
  return router.stack.flatMap((layer) => {
    if (!layer.route) return layer.handle.stack ? contracts(layer.handle) : [];
    const route = layer.route;
    return Object.keys(route.methods).map((method) => ({
      method,
      path: route.path,
      auth: route.stack.some((handler) => handler.handle === requireAuth),
      middlewareCount: route.stack.length
    }));
  });
}

test('all existing routes retain order, method, authentication and middleware count', () => {
  assert.deepEqual(contracts(mvpRouter), baseline);
});
test('proximity supports both payload formats and rejects invalid coordinates and radii', () => {
  assert.deepEqual(normalizeProjectProximity({ latitud: '-33.45', longitud: '-70.66', radioKm: 10 }), { latitude: -33.45, longitude: -70.66, radiusKm: 10 });
  assert.deepEqual(normalizeProjectProximity({ latitude: -33.45, longitude: -70.66, radiusKm: 5 }), { latitude: -33.45, longitude: -70.66, radiusKm: 5 });
  assert.equal(normalizeProjectProximity({ latitude: 91, longitude: 0, radiusKm: 5 }), null);
  assert.equal(normalizeProjectProximity({ latitude: 0, longitude: 0, radiusKm: 7 }), null);
  assert.equal(coordinateValue('', -90, 90), null);
  assert.equal(geographicDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
});
test('quotation item normalization preserves quantity rules and discards blank products', () => {
  assert.deepEqual(normalizeItems([{ productName: ' Cemento ', quantity: 2.9 }, { productName: '', quantity: 4 }, { productName: 'Clavos', quantity: -1 }]), [{ productName: 'Cemento', quantity: 2 }, { productName: 'Clavos', quantity: 1 }]);
  assert.deepEqual(normalizeItems(null), []);
});

test('role middleware rejects cross-role access with 403', async () => {
  const request = { authUserId: 'maestro-1', authRole: 'maestro' };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let nextCalled = false;

  await requireRole('admin')(request, response, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.payload?.error?.code, 'AUTH_FORBIDDEN');
});

test('role middleware allows only declared roles and ownership stays scoped', async () => {
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let nextCalled = false;

  await requireRole('maestro', 'admin')(
    { authUserId: 'maestro-1', authRole: 'maestro' },
    response,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
  assert.equal(canAccessOwner({ authUserId: 'maestro-1', authRole: 'maestro' }, 'maestro-1'), true);
  assert.equal(canAccessOwner({ authUserId: 'maestro-1', authRole: 'maestro' }, 'maestro-2'), false);
  assert.equal(canAccessOwner({ authUserId: 'admin-1', authRole: 'admin' }, 'maestro-2'), true);
});
