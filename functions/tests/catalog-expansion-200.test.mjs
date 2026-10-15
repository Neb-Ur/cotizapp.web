import test from 'node:test';
import assert from 'node:assert/strict';
import {expansionFixture} from './helpers/catalog-expansion.fixture.mjs';
import {planCatalogExpansion, missingExpansionDocuments} from '../scripts/lib/catalog-expansion-200.mjs';
const now = '2026-10-14T20:00:00Z';
test('expansion plans 100 specific car parts and 100 branded tools/materials with two offers per master', async () => {
  const {seed, state} = await expansionFixture(now);
  const previous = structuredClone(state);
  const plan = planCatalogExpansion(seed, state, now);
  assert.deepEqual(state, previous);
  assert.equal(plan.products.length, 200);
  assert.equal(plan.offers.length, 400);
  assert.equal(plan.products.filter(p => p.data.compatibilidadVehiculos).length, 100);
  const hardware = plan.products.filter(p => !p.data.compatibilidadVehiculos);
  assert.equal(hardware.length, 100);
  assert.equal(new Set(hardware.map(p => p.data.marcaId)).size, 21);
  assert.ok(hardware.every(p => p.data.marcaId));
  const docs = [...plan.prerequisites, ...plan.products, ...plan.offers];
  assert.equal(new Set(docs.map(d => d.collection + '/' + d.id)).size, docs.length);
  for (const [index, p] of plan.products.entries()) {
    const entry = seed.products[index];
    assert.deepEqual(p.data.galeriaJson, entry.images);
    assert.equal(p.data.referenciaAutorizacion, undefined);
    assert.ok(p.data.imagenReferencial && p.data.esPrueba);
    const offers = plan.offers.filter(o => o.data.productoMaestroId === p.id);
    assert.equal(offers.length, 2);
    assert.notEqual(offers[0].data.ferreteriaId, offers[1].data.ferreteriaId);
    assert.ok(offers[1].data.precio > offers[0].data.precio);
    assert.ok(offers.every(o => o.data.stock > 0 && o.data.asociacionesVehiculos.length === 0));
    if (entry.group === 'auto') assert.ok(p.data.nombre.includes(entry.years.join('–')) && p.data.compatibilidadReferencial);
  }
  const mahindra = state.brands.find(b => b.nombre === 'Mahindra');
  assert.deepEqual(new Set(plan.updates.find(d => d.id === mahindra.id).data.usos), new Set(['vehiculo', 'fabricante']));
  assert.equal(plan.prerequisites.filter(d => d.collection === 'modelosVehiculo').length, 2);
});
test('expansion rejects previous-source duplicates, inactive/real stores, invalid images and duplicate source references', async () => {
  const {seed, state} = await expansionFixture(now);
  state.products = [{id: 'existing', nombre: 'Another name', fuenteContenidoUrl: seed.products[0].sourceUrl}];
  assert.throws(() => planCatalogExpansion(seed, state, now), /EXISTING_PRODUCT/);
  state.products = [];state.stores[0].esPrueba = false;
  assert.throws(() => planCatalogExpansion(seed, state, now), /TEST_STORE_REQUIRED/);
  state.stores[0].esPrueba = true;seed.products[0].images = ['https://example.test/no_image.jpg'];
  assert.throws(() => planCatalogExpansion(seed, state, now), /IMAGES_INVALID/);
  const clean = await expansionFixture(now);
  clean.seed.products[1].code = clean.seed.products[0].code;
  assert.throws(() => planCatalogExpansion(clean.seed, clean.state, now), /SOURCE_DUPLICATE/);
});
test('expansion is idempotent, retains edits and rejects foreign IDs or archived rows', async () => {
  const {seed, state} = await expansionFixture(now);
  const p = planCatalogExpansion(seed, state, now), docs = [...p.prerequisites, ...p.products, ...p.offers];
  const existing = new Map(docs.map(d => [d.collection + '/' + d.id, {...d.data}]));
  existing.get(p.offers[0].collection + '/' + p.offers[0].id).precio = 99999;
  assert.deepEqual(missingExpansionDocuments(docs, existing), []);
  existing.get(p.products[0].collection + '/' + p.products[0].id).lotePrueba = 'foreign';
  assert.throws(() => missingExpansionDocuments(docs, existing), /IDENTITY_CONFLICT/);
  existing.set(p.products[0].collection + '/' + p.products[0].id, {deleted: true});
  assert.throws(() => missingExpansionDocuments(docs, existing), /IDENTITY_CONFLICT/);
});
