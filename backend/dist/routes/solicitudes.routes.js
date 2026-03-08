import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';
const solicitudCreacionSchema = z.object({
    nombreProducto: z.string().min(3),
    codigoBarras: z.string().min(8),
    cantidadReferencia: z.number().int().positive(),
    precioReferencia: z.number().positive()
});
const resolverSolicitudSchema = z.object({
    accion: z.enum(['aprobar', 'rechazar']),
    productoMaestroSugeridoId: z.string().uuid().optional(),
    notaAdmin: z.string().optional()
});
export const solicitudesRouter = Router();
solicitudesRouter.post('/ferreterias/:ferreteriaId/solicitudes-creacion-producto', requireAuth, requireRole('ferreteria', 'admin'), (req, res) => {
    const parsed = solicitudCreacionSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'SOLICITUD_INVALID_PAYLOAD', 'Payload invalido para solicitud de creacion.', 400, parsed.error.flatten());
    }
    const ferreteria = db.ferreterias.find((item) => item.id === req.params.ferreteriaId);
    if (!ferreteria) {
        return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
    }
    const created = {
        id: uuidv4(),
        ferreteriaId: ferreteria.id,
        usuarioSolicitanteId: req.authUserId,
        usuarioAdminId: null,
        nombreProducto: parsed.data.nombreProducto,
        codigoBarras: parsed.data.codigoBarras,
        cantidadReferencia: parsed.data.cantidadReferencia,
        precioReferencia: parsed.data.precioReferencia,
        estado: 'pendiente',
        productoMaestroSugeridoId: null,
        notasAdmin: '',
        fechaCreacion: new Date().toISOString(),
        fechaResolucion: null
    };
    db.solicitudesCreacionProducto.push(created);
    return ok(res, created, 201);
});
solicitudesRouter.get('/solicitudes-creacion-producto', requireAuth, requireRole('admin'), (req, res) => {
    const estado = (req.query.estado || '').trim();
    const ferreteriaId = (req.query.ferreteriaId || '').trim();
    const rows = db.solicitudesCreacionProducto
        .filter((item) => !estado || item.estado === estado)
        .filter((item) => !ferreteriaId || item.ferreteriaId === ferreteriaId)
        .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
    return ok(res, rows);
});
solicitudesRouter.post('/solicitudes-creacion-producto/:solicitudId/resolver', requireAuth, requireRole('admin'), (req, res) => {
    const parsed = resolverSolicitudSchema.safeParse(req.body);
    if (!parsed.success) {
        return fail(res, 'SOLICITUD_INVALID_PAYLOAD', 'Payload invalido para resolver solicitud.', 400, parsed.error.flatten());
    }
    const target = db.solicitudesCreacionProducto.find((item) => item.id === req.params.solicitudId);
    if (!target) {
        return fail(res, 'SOLICITUD_NOT_FOUND', 'No existe la solicitud indicada.', 404);
    }
    if (target.estado !== 'pendiente') {
        return fail(res, 'SOLICITUD_ALREADY_RESOLVED', 'La solicitud ya fue resuelta.', 409);
    }
    const payload = parsed.data;
    target.estado = payload.accion === 'aprobar' ? 'aprobada' : 'rechazada';
    target.usuarioAdminId = req.authUserId;
    target.productoMaestroSugeridoId = payload.productoMaestroSugeridoId || null;
    target.notasAdmin = payload.notaAdmin || '';
    target.fechaResolucion = new Date().toISOString();
    return ok(res, target);
});
