import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.middleware.js';
import { db } from '../services/in-memory-db.service.js';
import { fail, getTokenFromRequest, ok } from '../utils/http.js';

const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional()
});

const registerSchema = z.object({
  rol: z.enum(['maestro', 'ferreteria']),
  nombre: z.string().min(3),
  correo: z.string().email(),
  password: z.string().min(6),
  telefono: z.string().min(8),
  ciudad: z.string().min(1),
  comuna: z.string().min(1),
  direccion: z.string().min(1),
  nombreComercial: z.string().optional(),
  rut: z.string().optional()
});

const updateProfileSchema = z.object({
  nombre: z.string().min(3).optional(),
  telefono: z.string().min(8).optional(),
  ciudad: z.string().min(1).optional(),
  comuna: z.string().min(1).optional(),
  direccion: z.string().min(1).optional(),
  planSuscripcion: z.enum(['basico', 'pro', 'premium']).optional()
});

const toAuthUserResponse = (userId: string) => {
  const user = db.usuarios.find((item) => item.id === userId);
  if (!user) {
    return null;
  }

  const ferreteria = db.ferreterias.find((item) => item.usuarioDuenoId === user.id);
  return {
    ...db.toPublicUser(user),
    ferreteriaId: ferreteria?.id,
    nombreComercial: ferreteria?.nombreComercial,
    rut: ferreteria?.rut
  };
};

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Payload invalido para login.', 400, parsed.error.flatten());
  }

  const { correo, password } = parsed.data;
  const user = db.usuarios.find((item) => item.correo.toLowerCase() === correo.toLowerCase() && item.passwordHash === password);
  if (!user) {
    return fail(res, 'AUTH_INVALID_CREDENTIALS', 'Credenciales invalidas.', 401);
  }

  if (user.estadoCuenta === 'bloqueado') {
    return fail(res, 'AUTH_BLOCKED', 'Tu cuenta esta bloqueada.', 403);
  }

  const sesion = db.createSession(user.id);
  const authUser = toAuthUserResponse(user.id);
  if (!authUser) {
    return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el usuario.', 404);
  }

  return ok(res, {
    token: sesion.token,
    usuario: authUser
  });
});

authRouter.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Payload invalido para registro.', 400, parsed.error.flatten());
  }

  const payload = parsed.data;
  const exists = db.usuarios.some((item) => item.correo.toLowerCase() === payload.correo.toLowerCase());
  if (exists) {
    return fail(res, 'AUTH_EMAIL_EXISTS', 'Ya existe una cuenta con este correo.', 409);
  }

  const newUserId = uuidv4();
  db.usuarios.unshift({
    id: newUserId,
    rol: payload.rol,
    nombre: payload.nombre,
    correo: payload.correo.toLowerCase(),
    passwordHash: payload.password,
    telefono: payload.telefono,
    ciudad: payload.ciudad,
    comuna: payload.comuna,
    direccion: payload.direccion,
    planSuscripcion: 'basico',
    estadoCuenta: 'pendiente',
    creadoEn: new Date().toISOString()
  });

  if (payload.rol === 'ferreteria') {
    db.ferreterias.unshift({
      id: uuidv4(),
      usuarioDuenoId: newUserId,
      nombreComercial: payload.nombreComercial?.trim() || payload.nombre,
      rut: payload.rut?.trim() || '',
      estado: 'activo',
      creadoEn: new Date().toISOString()
    });
  }

  const sesion = db.createSession(newUserId);
  const authUser = toAuthUserResponse(newUserId);
  if (!authUser) {
    return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el usuario.', 404);
  }

  return ok(res, {
    token: sesion.token,
    usuario: authUser
  }, 201);
});

authRouter.get('/me', requireAuth, (req, res) => {
  const authUser = toAuthUserResponse(req.authUserId as string);
  if (!authUser) {
    return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el usuario autenticado.', 404);
  }
  return ok(res, authUser);
});

authRouter.patch('/me', requireAuth, (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Payload invalido para actualizar perfil.', 400, parsed.error.flatten());
  }

  const user = db.usuarios.find((item) => item.id === req.authUserId);
  if (!user) {
    return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el usuario autenticado.', 404);
  }

  const payload = parsed.data;
  if (payload.nombre !== undefined) user.nombre = payload.nombre;
  if (payload.telefono !== undefined) user.telefono = payload.telefono;
  if (payload.ciudad !== undefined) user.ciudad = payload.ciudad;
  if (payload.comuna !== undefined) user.comuna = payload.comuna;
  if (payload.direccion !== undefined) user.direccion = payload.direccion;
  if (payload.planSuscripcion !== undefined) user.planSuscripcion = payload.planSuscripcion;

  const authUser = toAuthUserResponse(user.id);
  if (!authUser) {
    return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el usuario autenticado.', 404);
  }

  return ok(res, authUser);
});

authRouter.post('/logout', requireAuth, (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) {
    db.revokeSession(token);
  }
  return ok(res, { success: true });
});
