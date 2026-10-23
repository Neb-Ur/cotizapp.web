import { publishProposedProduct } from '../services/proposed-product.service.js';
import { invalidateStaticCatalog } from '../lib/product-sheet-cache.js';
import { markPublicCatalogDirty } from '../lib/public-catalog-cache.js';
import { ProductRequestError, resolveProductRequest } from '../services/product-request-resolution.service.js';
import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, createRow } from '../repositories/firestore.repository.js';
import { requireStoreWriteAccess } from '../lib/ownership.js';
import { requireCurrentStoreAgreement } from '../services/store-agreement.service.js';
export const productRequestsRouter = Router();

productRequestsRouter.post('/ferreterias/:storeId/solicitudes-creacion-producto', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  if (!(await requireCurrentStoreAgreement(req, res, req.params.storeId))) return;
  try {
    const created = await publishProposedProduct(req.params.storeId, req.authUserId!, {
      name: normalizeText(req.body?.nombreProducto), area: req.body?.rubro, published: req.body?.publicado !== false,
      barcode: normalizeText(req.body?.codigoBarras), sku: normalizeText(req.body?.skuFerreteria),
      price: numberValue(req.body?.precioReferencia), stock: numberValue(req.body?.cantidadReferencia),
      categoryId: normalizeText(req.body?.categoriaId), subcategoryId: normalizeText(req.body?.subcategoriaId), familyId: normalizeText(req.body?.familiaId)
    });
    await Promise.all([invalidateStaticCatalog(), markPublicCatalogDirty()]);
    return ok(res, created, 201);
  } catch(error) {
    if(error instanceof ProductRequestError) return fail(res,error.code,error.message,error.status);
    throw error;
  }
});

productRequestsRouter.get('/solicitudes-creacion-producto', requireAuth, requireRole('admin'), async (req, res) => {
  const status = normalizeText(req.query['estado']);
  const storeId = normalizeText(req.query['ferreteriaId']);
  const data = (await rows(COLLECTIONS.productRequests))
    .filter((item) => !status || item.estado === status)
    .filter((item) => !storeId || item.ferreteriaId === storeId)
    .sort((a, b) => normalizeText(b.fechaCreacion).localeCompare(normalizeText(a.fechaCreacion)));
  return ok(res, data);
});

productRequestsRouter.post('/solicitudes-creacion-producto/:id/resolver', requireAuth, requireRole('admin'), async (req, res) => {
  const action = req.body?.accion;
  if (!['aprobar', 'rechazar'].includes(action)) return fail(res, 'SOLICITUD_INVALID_PAYLOAD', 'Accion invalida.', 400);
  try {
    const result = await resolveProductRequest(req.params.id, action,
      normalizeText(req.body?.productoMaestroSugeridoId), req.authUserId!, normalizeText(req.body?.notaAdmin));
    await Promise.all([invalidateStaticCatalog(),markPublicCatalogDirty()]);
    return ok(res,result);
  } catch (error) {
    if (error instanceof ProductRequestError) return fail(res, error.code, error.message, error.status);
    throw error;
  }
});

// Admin users.
