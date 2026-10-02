import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { normalizeText, numberValue, boolValue } from '../lib/values.js';
import { rows, createRow, patchRow } from '../repositories/firestore.repository.js';
export const taxonomyRouter = Router();

taxonomyRouter.get('/categorias', async (_req, res) => ok(res, (await rows(COLLECTIONS.categories)).sort((a, b) => a.nombre.localeCompare(b.nombre))));

taxonomyRouter.post('/categorias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  if (!nombre) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Nombre requerido.', 400);
  return ok(res, await createRow(COLLECTIONS.categories, { nombre }), 201);
});

taxonomyRouter.patch('/categorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const updated = await patchRow(COLLECTIONS.categories, req.params.id, { nombre });
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Categoria no encontrada.', 404);
});

taxonomyRouter.delete('/categorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.categories).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

taxonomyRouter.get('/subcategorias', async (req, res) => {
  const categoryId = normalizeText(req.query['categoriaId']);
  const data = (await rows(COLLECTIONS.subcategories))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return ok(res, data);
});

taxonomyRouter.post('/subcategorias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const categoriaId = normalizeText(req.body?.categoriaId);
  if (!nombre || !categoriaId) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Categoria y nombre son requeridos.', 400);
  return ok(res, await createRow(COLLECTIONS.subcategories, { nombre, categoriaId }), 201);
});

taxonomyRouter.patch('/subcategorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const patch: Record<string, unknown> = {};
  if (req.body?.nombre !== undefined) patch['nombre'] = normalizeText(req.body.nombre);
  if (req.body?.categoriaId !== undefined) patch['categoriaId'] = normalizeText(req.body.categoriaId);
  const updated = await patchRow(COLLECTIONS.subcategories, req.params.id, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Subcategoria no encontrada.', 404);
});

taxonomyRouter.delete('/subcategorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.subcategories).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

taxonomyRouter.get('/familias', async (req, res) => {
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const data = (await rows(COLLECTIONS.families))
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return ok(res, data);
});

taxonomyRouter.post('/familias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const subcategoriaId = normalizeText(req.body?.subcategoriaId);
  if (!nombre || !subcategoriaId) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Subcategoria y nombre son requeridos.', 400);
  return ok(res, await createRow(COLLECTIONS.families, { nombre, subcategoriaId }), 201);
});

taxonomyRouter.patch('/familias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const patch: Record<string, unknown> = {};
  if (req.body?.nombre !== undefined) patch['nombre'] = normalizeText(req.body.nombre);
  if (req.body?.subcategoriaId !== undefined) patch['subcategoriaId'] = normalizeText(req.body.subcategoriaId);
  const updated = await patchRow(COLLECTIONS.families, req.params.id, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Familia no encontrada.', 404);
});

taxonomyRouter.delete('/familias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.families).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

taxonomyRouter.get('/atributos-definicion', async (_req, res) => {
  const data = (await rows(COLLECTIONS.familyDefinitions))
    .sort((a, b) => {
      const familyOrder = String(a.familiaId || '').localeCompare(String(b.familiaId || ''));
      return familyOrder || numberValue(a.orden) - numberValue(b.orden);
    });
  return ok(res, data);
});

taxonomyRouter.get('/familias/:familyId/atributos-definicion', async (req, res) => {
  const data = (await rows(COLLECTIONS.familyDefinitions))
    .filter((item) => item.familiaId === req.params.familyId)
    .sort((a, b) => numberValue(a.orden) - numberValue(b.orden));
  return ok(res, data);
});

taxonomyRouter.post('/familias/:familyId/atributos-definicion', requireAuth, requireRole('admin'), async (req, res) => {
  const created = await createRow(COLLECTIONS.familyDefinitions, {
    familiaId: req.params.familyId,
    codigo: normalizeText(req.body?.codigo),
    etiqueta: normalizeText(req.body?.etiqueta),
    tipoDato: req.body?.tipoDato || 'texto',
    esFiltrable: boolValue(req.body?.esFiltrable),
    esObligatorio: boolValue(req.body?.esObligatorio),
    opcionesJson: Array.isArray(req.body?.opcionesJson) ? req.body.opcionesJson : [],
    orden: numberValue(req.body?.orden)
  });
  return ok(res, created, 201);
});

taxonomyRouter.patch('/familias/:familyId/atributos-definicion/:definitionId', requireAuth, requireRole('admin'), async (req, res) => {
  const patch = { ...req.body, familiaId: req.params.familyId };
  const updated = await patchRow(COLLECTIONS.familyDefinitions, req.params.definitionId, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_DEFINITION_NOT_FOUND', 'Definicion no encontrada.', 404);
});

taxonomyRouter.delete('/familias/:familyId/atributos-definicion/:definitionId', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.familyDefinitions).doc(req.params.definitionId).delete();
  return ok(res, { deleted: true });
});

// Master catalog.
