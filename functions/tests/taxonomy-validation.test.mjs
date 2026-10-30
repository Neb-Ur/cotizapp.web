import test from 'node:test';
import assert from 'node:assert/strict';
import { taxonomyRouter } from '../lib/routes/taxonomy.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';

const handler = path => taxonomyRouter.stack.find(layer => layer.route?.path === path && layer.route.methods.delete).route.stack.at(-1).handle;
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

for (const dependency of [
  { path: '/categorias/:id', collection: 'categorias', child: 'subcategorias', field: 'categoriaId' },
  { path: '/categorias/:id', collection: 'categorias', child: 'productosMaestro', field: 'categoriaId' },
  { path: '/subcategorias/:id', collection: 'subcategorias', child: 'familias', field: 'subcategoriaId' },
  { path: '/subcategorias/:id', collection: 'subcategorias', child: 'productosMaestro', field: 'subcategoriaId' },
  { path: '/familias/:id', collection: 'familias', child: 'productosMaestro', field: 'familiaId' },
  { path: '/familias/:id', collection: 'familias', child: 'definicionesAtributoFamilia', field: 'familiaId' }
]) {
  test(`deleting ${dependency.collection} with ${dependency.child} returns a conflict and preserves the parent`, async t => {
    const fixture = firestoreFixture(t, { [dependency.collection]: { parent: { nombre: 'Conservar' } }, [dependency.child]: { child: { [dependency.field]: 'parent' } } });
    const res = response();
    await handler(dependency.path)({ params: { id: 'parent' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error.code, 'TAXONOMIA_IN_USE');
    assert.equal(fixture.get(dependency.collection, 'parent').nombre, 'Conservar');
    assert.ok(fixture.get(dependency.child, 'child'));
  });
}

test('unused taxonomy records can still be deleted', async t => {
  const fixture = firestoreFixture(t, { categorias: { category: { nombre: 'Vacía' } }, subcategorias: { subcategory: { nombre: 'Vacía' } }, familias: { family: { nombre: 'Vacía' } } });
  for (const [path, collection, id] of [['/categorias/:id', 'categorias', 'category'], ['/subcategorias/:id', 'subcategorias', 'subcategory'], ['/familias/:id', 'familias', 'family']]) {
    const res = response();
    await handler(path)({ params: { id } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(fixture.get(collection, id), undefined);
  }
});
