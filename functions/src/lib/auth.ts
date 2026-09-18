import type { NextFunction, Request, Response } from 'express';
import { adminAuth, db } from './firebase.js';
import { fail } from './http.js';

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authRole?: 'maestro' | 'ferreteria' | 'admin';
    }
  }
}

function bearerToken(req: Request): string | null {
  const value = req.header('authorization') || req.header('Authorization');
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.authUserId = decoded.uid;
    const profile = await db.collection('usuarios').doc(decoded.uid).get();
    if (profile.exists) {
      const role = profile.data()?.['rol'];
      if (role === 'maestro' || role === 'ferreteria' || role === 'admin') {
        req.authRole = role;
      }
    }
    next();
  } catch {
    fail(res, 'AUTH_INVALID_TOKEN', 'Token invalido o expirado.', 401);
  }
}

export function requireRole(...roles: Array<'maestro' | 'ferreteria' | 'admin'>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUserId) {
      fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
      return;
    }

    let role = req.authRole;
    if (!role) {
      const profile = await db.collection('usuarios').doc(req.authUserId).get();
      role = profile.data()?.['rol'];
    }

    if (!role || !roles.includes(role)) {
      fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta accion.', 403);
      return;
    }

    next();
  };
}
