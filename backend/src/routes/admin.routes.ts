import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, ok } from '../utils/http.js';

const updateUsuarioSchema = z.object({
  planSuscripcion: z.enum(['basico', 'pro', 'premium']).optional(),
  estadoCuenta: z.enum(['activo', 'bloqueado', 'pendiente']).optional(),
  nombre: z.string().min(2).optional(),
  telefono: z.string().min(8).optional(),
  ciudad: z.string().min(1).optional(),
  comuna: z.string().min(1).optional(),
  direccion: z.string().min(1).optional()
});

export const adminRouter = Router();

adminRouter.get('/admin/usuarios', requireAuth, requireRole('admin'), (_req, res) => {
  const users = db.usuarios
    .map((user) => {
      const ferreteria = db.ferreterias.find((item) => item.usuarioDuenoId === user.id);
      return {
        ...db.toPublicUser(user),
        ferreteriaId: ferreteria?.id,
        nombreComercial: ferreteria?.nombreComercial,
        rut: ferreteria?.rut
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return ok(res, users);
});

adminRouter.patch('/admin/usuarios/:usuarioId', requireAuth, requireRole('admin'), (req, res) => {
  const parsed = updateUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'ADMIN_USUARIO_INVALID_PAYLOAD', 'Payload invalido para actualizar usuario.', 400, parsed.error.flatten());
  }

  const target = db.usuarios.find((item) => item.id === req.params.usuarioId);
  if (!target) {
    return fail(res, 'ADMIN_USUARIO_NOT_FOUND', 'No existe el usuario indicado.', 404);
  }

  const payload = parsed.data;
  if (payload.planSuscripcion !== undefined) target.planSuscripcion = payload.planSuscripcion;
  if (payload.estadoCuenta !== undefined) target.estadoCuenta = payload.estadoCuenta;
  if (payload.nombre !== undefined) target.nombre = payload.nombre;
  if (payload.telefono !== undefined) target.telefono = payload.telefono;
  if (payload.ciudad !== undefined) target.ciudad = payload.ciudad;
  if (payload.comuna !== undefined) target.comuna = payload.comuna;
  if (payload.direccion !== undefined) target.direccion = payload.direccion;

  return ok(res, db.toPublicUser(target));
});

adminRouter.get('/admin/metricas', requireAuth, requireRole('admin'), (_req, res) => {
  const totalUsuarios = db.usuarios.length;
  const nuevosUsuarios = db.usuarios.filter((u) => {
    const created = Date.parse(u.creadoEn);
    return Number.isFinite(created) && created >= (Date.now() - (30 * 24 * 60 * 60 * 1000));
  }).length;

  const usuariosPago = db.usuarios.filter((u) => u.planSuscripcion === 'pro' || u.planSuscripcion === 'premium').length;
  const usuariosActivos = db.usuarios.filter((u) => u.estadoCuenta === 'activo').length;
  const maestros = db.usuarios.filter((u) => u.rol === 'maestro').length;
  const ferreterias = db.usuarios.filter((u) => u.rol === 'ferreteria').length;

  return ok(res, {
    totalUsuarios,
    nuevosUsuarios,
    usuariosPago,
    usuariosActivos,
    maestros,
    ferreterias,
    cotizaciones: 0,
    cotizacionesRechazadas: 0,
    cotizacionesAceptadas: 0,
    productosMaestro: db.productosMaestro.length,
    solicitudesPendientes: db.solicitudesCreacionProducto.filter((s) => s.estado === 'pendiente').length
  });
});
