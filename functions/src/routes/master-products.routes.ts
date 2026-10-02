import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, row, createRow, patchRow, deleteRowsByIds } from '../repositories/firestore.repository.js';
export const masterProductsRouter = Router();

masterProductsRouter.get('/productos-maestro', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const data = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => item.estado !== 'inactivo')
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q) || normalizeText(item.codigoBarras).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  return ok(res, data);
});

masterProductsRouter.get('/productos-maestro/paginado', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const excluded = new Set(normalizeText(req.query['excludeProductoMaestroIds']).split(',').filter(Boolean));
  const page = Math.max(1, Math.floor(numberValue(req.query['page'], 1)));
  const size = Math.min(100, Math.max(1, Math.floor(numberValue(req.query['size'], 25))));
  const all = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => item.estado !== 'inactivo')
    .filter((item) => !excluded.has(item.id))
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q) || normalizeText(item.codigoBarras).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const items = all.slice((safePage - 1) * size, safePage * size);
  return ok(res, { items, page: safePage, size, total, totalPages });
});

masterProductsRouter.get('/productos-maestro/:id', async (req, res) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const atributos = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === product.id);
  return ok(res, { ...product, atributos });
});

masterProductsRouter.post('/productos-maestro', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  if (!nombre) return fail(res, 'PRODUCTO_MAESTRO_INVALID_PAYLOAD', 'Nombre requerido.', 400);
  const created = await createRow(COLLECTIONS.masterProducts, {
    categoriaId: normalizeText(req.body?.categoriaId),
    subcategoriaId: normalizeText(req.body?.subcategoriaId),
    familiaId: normalizeText(req.body?.familiaId),
    nombre,
    marca: normalizeText(req.body?.marca) || 'Sin marca',
    codigoBarras: normalizeText(req.body?.codigoBarras),
    descripcionCorta: normalizeText(req.body?.descripcionCorta),
    descripcionLarga: normalizeText(req.body?.descripcionLarga),
    imagenPrincipalUrl: normalizeText(req.body?.imagenPrincipalUrl),
    galeriaJson: Array.isArray(req.body?.galeriaJson) ? req.body.galeriaJson : [],
    estado: req.body?.estado === 'inactivo' ? 'inactivo' : 'activo',
    creadoEn: nowIso()
  });
  return ok(res, created, 201);
});

masterProductsRouter.patch('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const updated = await patchRow(COLLECTIONS.masterProducts, req.params.id, req.body || {});
  return updated ? ok(res, updated) : fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
});

masterProductsRouter.put('/productos-maestro/:id/atributos', requireAuth, requireRole('admin'), async (req, res) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const current = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, current.map((item) => item.id));
  const result: any[] = [];
  for (const item of Array.isArray(req.body) ? req.body : []) {
    result.push(await createRow(COLLECTIONS.masterAttributes, { productoMaestroId: req.params.id, ...item }));
  }
  return ok(res, result);
});

masterProductsRouter.delete('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.masterProducts).doc(req.params.id).delete();
  const attributes = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, attributes.map((item) => item.id));
  return ok(res, { deleted: true });
});

// Search/comparison.
