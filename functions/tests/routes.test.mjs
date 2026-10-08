import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mvpRouter } from '../lib/routes/mvp.routes.js';
import { requireAuth, requireRole } from '../lib/lib/auth.js';
import { canAccessOwner } from '../lib/lib/ownership.js';
import { normalizeProjectProximity, coordinateValue, geographicDistanceKm, inferMeasurementFromLabel, pricePerMeasurement, validChileanTaxId, validStrongPassword } from '../lib/lib/values.js';
import { normalizeItems } from '../lib/services/quotation.service.js';
import { calendarDeadline, conservativeBlockingDeadline, isPrivacyRequestType } from '../lib/lib/legal.js';

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

test('new account passwords must meet the application security policy', () => {
  assert.equal(validStrongPassword('123456'), false);
  assert.equal(validStrongPassword('onlylowercase123!'), false);
  assert.equal(validStrongPassword('SinSimbolo1234'), false);
  assert.equal(validStrongPassword('Findi!2026-segura'), true);
});

test('Chilean tax identifiers are validated before signing a store agreement', () => {
  assert.equal(validChileanTaxId('76.000.000-0'), true);
  assert.equal(validChileanTaxId('12.345.678-5'), true);
  assert.equal(validChileanTaxId('12.345.678-9'), false);
  assert.equal(validChileanTaxId('sin-rut'), false);
});

test('unit pricing is calculated only from a positive declared measure', () => {
  assert.equal(pricePerMeasurement(4990, 25), 199.6);
  assert.equal(pricePerMeasurement(15990, 2.9768), 5371.54);
  assert.equal(pricePerMeasurement(4990, 0), null);
  assert.equal(pricePerMeasurement(0, 25), null);
  assert.deepEqual(inferMeasurementFromLabel('Cemento gris 25 kg'), { unit: 'kg', quantity: 25 });
  assert.deepEqual(inferMeasurementFromLabel('Plancha OSB 1,22 x 2,44 m'), { unit: 'm2', quantity: 2.9768 });
  assert.deepEqual(inferMeasurementFromLabel('Silicona 300 ml'), { unit: 'l', quantity: 0.3 });
  assert.equal(inferMeasurementFromLabel('Taladro percutor'), null);
});

test('privacy requests accept only supported rights and calculate statutory deadlines', () => {
  assert.equal(isPrivacyRequestType('blocking'), true);
  assert.equal(isPrivacyRequestType('marketing_everything'), false);
  assert.equal(calendarDeadline(new Date('2026-10-02T12:00:00.000Z'), 30), '2026-11-01T12:00:00.000Z');
  assert.equal(conservativeBlockingDeadline(new Date('2026-10-02T12:00:00.000Z')), '2026-10-04T12:00:00.000Z');
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
