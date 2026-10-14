import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildKuv100CatalogSeed, missingKuv100SeedDocuments} from '../scripts/lib/kuv100-catalog-seed.mjs';
const load = async () => JSON.parse(await readFile(new URL('../../docs/catalogo/semilla-kuv100-ampliada.json', import.meta.url), 'utf8'));
const brands = [{id: 'mahindra', nombre: 'Mahindra'}];
const models = [{id: 'kuv100', nombre: 'KUV100', marcaId: 'mahindra', activo: true}];
test('KUV catalog keeps specific images, codes and bounded year ranges; stores share masters without duplicating offers', async () => {
  const seed = await load();
  const docs = buildKuv100CatalogSeed(seed, brands, models, '2026-10-14T00:00:00Z');
  const masters = docs.filter(d => d.collection === 'productosMaestro');
  const offers = docs.filter(d => d.collection === 'real_productosFerreteria');
  assert.equal(masters.length, 44);
  assert.equal(offers.length, 110);
  assert.equal(new Set(docs.map(d => d.collection + '/' + d.id)).size, docs.length);
  assert.equal(new Set(offers.map(d => d.data.ferreteriaId + '/' + d.data.productoMaestroId)).size, offers.length);
  for (const [i, d] of masters.entries()) {
    const p = d.data, entry = seed.products[i];
    assert.deepEqual(p.galeriaJson, entry.images);
    assert.ok(p.imagenReferencial && p.compatibilidadReferencial && p.esPrueba);
    assert.equal(p.referenciaAutorizacion, undefined);
    assert.equal(p.referenciaProveedor, entry.code);
    if (entry.sourceUrl.includes('fitalia.cl')) assert.equal(p.codigoFabricante, null);
    assert.ok(p.nombre.includes('Mahindra KUV100 ' + entry.years.join('–')));
    const publications = offers.filter(o => o.data.productoMaestroId === d.id);
    assert.ok(publications.length >= 2);
    assert.ok(new Set(publications.map(o => o.data.precio)).size >= 2);
    assert.ok(publications.every(o => o.data.stock > 0 && o.data.asociacionesVehiculos.length === 0));
  }
  assert.equal(docs.filter(d => d.collection === 'real_ferreterias' && d.data.tipoNegocio === 'desarmaduria' && d.data.esPrueba && d.data.contratoEstado === 'pendiente' && d.data.latitud === null).length, 3);
});
test('KUV importer skips existing seed rows, preserves edits and refuses foreign identities', async () => {
  const docs = buildKuv100CatalogSeed(await load(), brands, models, '2026-10-14T00:00:00Z');
  const existing = new Map(docs.map(d => [d.collection + '/' + d.id, {...d.data}]));
  assert.deepEqual(missingKuv100SeedDocuments(docs, existing), []);
  const offer = docs.find(d => d.collection === 'real_productosFerreteria');
  existing.get(offer.collection + '/' + offer.id).precio = 123456;
  assert.deepEqual(missingKuv100SeedDocuments(docs, existing), []);
  existing.get(offer.collection + '/' + offer.id).esPrueba = false;
  assert.throws(() => missingKuv100SeedDocuments(docs, existing), /IDENTITY_CONFLICT/);
});
test('KUV seed rejects placeholders, duplicate source keys and missing vehicle references', async () => {
  const seed = await load();
  assert.throws(() => buildKuv100CatalogSeed(seed, brands, [], 'now'), /VEHICLE_REQUIRED/);
  seed.products[0].images = ['https://example.test/no_image.jpg'];
  assert.throws(() => buildKuv100CatalogSeed(seed, brands, models, 'now'), /IMAGE_INVALID/);
  const duplicate = await load(); duplicate.products.push(duplicate.products[0]);
  assert.throws(() => buildKuv100CatalogSeed(duplicate, brands, models, 'now'), /PRODUCT_INVALID/);
});
