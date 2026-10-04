import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductRequest } from '../lib/services/product-request-resolution.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const request = { estado: 'pendiente', ferreteriaId: 'store', precioReferencia: 1500, cantidadReferencia: 0, skuFerreteria: 'LOCAL-123', codigoBarras: '7800001', publicado: false };
const seed = { solicitudesCreacionProducto: { request }, ferreterias: { store: {} }, productosMaestro: { master: { estado: 'activo' } } };
test('approval creates the store offer, preserving imported identity, zero stock and publication choice', async t => {
 const fixture = firestoreFixture(t, seed);
 const result = await resolveProductRequest('request', 'aprobar', 'master', 'admin', 'Validado');
 const offer = fixture.get('productosFerreteria', result.productoFerreteriaId);
 assert.equal(offer.skuFerreteria, 'LOCAL-123'); assert.equal(offer.codigoBarras, '7800001');
 assert.equal(offer.precio, 1500); assert.equal(offer.stock, 0); assert.equal(offer.publicado, false);
 assert.equal(offer.productoMaestroId, 'master'); assert.equal(offer.ferreteriaId, 'store');
 assert.equal(fixture.rows('historialPrecios').length, 1);
 const repeated = await resolveProductRequest('request', 'aprobar', 'master', 'admin', 'Validado');
 assert.equal(repeated.productoFerreteriaId, result.productoFerreteriaId);
 assert.equal(fixture.rows('productosFerreteria').length, 1);
 assert.equal(fixture.rows('historialPrecios').length, 1);
});
test('approval reuses an existing offer without overwriting maintained pricing', async t => {
 const offer = { ferreteriaId: 'store', productoMaestroId: 'master', precio: 5000, stock: 10, publicado: true };
 const fixture = firestoreFixture(t, { ...seed, productosFerreteria: { existing: offer } });
 const result = await resolveProductRequest('request', 'aprobar', 'master', 'admin', '');
 assert.equal(result.productoFerreteriaId, 'existing');
 assert.deepEqual(fixture.get('productosFerreteria', 'existing'), offer);
});
test('missing master fails before any write; rejected requests create no offers', async t => {
 const fixture = firestoreFixture(t, seed);
 await assert.rejects(resolveProductRequest('request', 'aprobar', 'missing', 'admin', ''), error => error.code === 'PRODUCTO_MAESTRO_NOT_FOUND');
 assert.equal(fixture.get('solicitudesCreacionProducto', 'request').estado, 'pendiente');
 assert.equal(fixture.rows('productosFerreteria').length, 0);
 await resolveProductRequest('request', 'rechazar', '', 'admin', 'No corresponde');
 assert.equal(fixture.get('solicitudesCreacionProducto', 'request').estado, 'rechazada');
 assert.equal(fixture.rows('productosFerreteria').length, 0);
});
test('legacy approved request without an offer can be repaired idempotently', async t => {
 const fixture = firestoreFixture(t, { ...seed, solicitudesCreacionProducto: { request: { ...request, estado: 'aprobada', productoMaestroSugeridoId: 'master' } } });
 await resolveProductRequest('request', 'aprobar', 'master', 'admin', '');
 assert.equal(fixture.rows('productosFerreteria').length, 1);
});
