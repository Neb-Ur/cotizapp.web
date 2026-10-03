import { Router } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, row, createRow, patchRow } from '../repositories/firestore.repository.js';
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
    cantidadReferencia: Math.max(1, Math.floor(numberValue(req.body?.cantidadReferencia, 1))),
    precioReferencia: Math.max(0, numberValue(req.body?.precioReferencia)),
    estado: 'pendiente',
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
  const current = await row(COLLECTIONS.productRequests, req.params.id);
  if (!current) return fail(res, 'SOLICITUD_NOT_FOUND', 'No existe la solicitud indicada.', 404);
  const action = req.body?.accion;
  if (!['aprobar', 'rechazar'].includes(action)) return fail(res, 'SOLICITUD_INVALID_PAYLOAD', 'Accion invalida.', 400);
  const updated = await patchRow(COLLECTIONS.productRequests, req.params.id, {
    estado: action === 'aprobar' ? 'aprobada' : 'rechazada',
    usuarioAdminId: req.authUserId,
    productoMaestroSugeridoId: normalizeText(req.body?.productoMaestroSugeridoId) || null,
    notasAdmin: normalizeText(req.body?.notaAdmin),
    fechaResolucion: nowIso()
  });
  return ok(res, updated);
});

// Admin users.
