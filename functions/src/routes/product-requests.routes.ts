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
  const created = await createRow(COLLECTIONS.productRequests, {
    ferreteriaId: req.params.storeId,
    usuarioSolicitanteId: req.authUserId,
    usuarioAdminId: null,
    nombreProducto: normalizeText(req.body?.nombreProducto),
    codigoBarras: normalizeText(req.body?.codigoBarras),
    skuFerreteria: normalizeText(req.body?.skuFerreteria),
    publicado: req.body?.publicado !== false,
    cantidadReferencia: Math.max(0, Math.floor(numberValue(req.body?.cantidadReferencia, 1))),
    precioReferencia: Math.max(0, numberValue(req.body?.precioReferencia)),
    estado: 'pendiente',
    tipoSolicitud: req.body?.tipoSolicitud === 'posible_match' ? 'posible_match' : 'nuevo_producto',
    productoMaestroSugeridoId: null,
    notasAdmin: '',
    fechaCreacion: nowIso(),
    fechaResolucion: null
  });
  return ok(res, created, 201);
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
    return ok(res, await resolveProductRequest(req.params.id, action,
      normalizeText(req.body?.productoMaestroSugeridoId), req.authUserId!, normalizeText(req.body?.notaAdmin)));
  } catch (error) {
    if (error instanceof ProductRequestError) return fail(res, error.code, error.message, error.status);
    throw error;
  }
});

// Admin users.
