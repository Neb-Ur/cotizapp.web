import type { NextFunction, Request, Response } from 'express';
import { db } from '../services/in-memory-db.service.js';
import { fail, getTokenFromRequest } from '../utils/http.js';

declare module 'express-serve-static-core' {
  interface Request {
    authUserId?: string;
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void | Response => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  }

  const session = db.getSession(token);
  if (!session) {
    return fail(res, 'AUTH_INVALID_TOKEN', 'Token invalido o expirado.', 401);
  }

  req.authUserId = session.usuarioId;
  next();
};

export const requireRole = (...roles: Array<'maestro' | 'ferreteria' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.authUserId) {
      return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
    }

    const user = db.usuarios.find((item) => item.id === req.authUserId);
    if (!user) {
      return fail(res, 'AUTH_NOT_FOUND', 'Usuario no encontrado.', 401);
    }

    if (!roles.includes(user.rol)) {
      return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta accion.', 403);
    }

    next();
  };
};
