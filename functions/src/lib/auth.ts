import type { NextFunction, Request, Response } from 'express';
import { adminAuth, db } from './firebase.js';
import { fail } from './http.js';
import { COLLECTIONS } from './collections.js';
import { hasCurrentLegalAcceptance } from '../services/consent.service.js';

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authRole?: 'maestro' | 'ferreteria' | 'admin';
      authSecondFactor?: string;
      authTime?: number;
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
    // The second argument rejects sessions revoked after a credential leak,
    // password reset or explicit administrative revocation.
    const decoded = await adminAuth.verifyIdToken(token, true);
    req.authUserId = decoded.uid;
    req.authTime = decoded.auth_time;
    req.authSecondFactor = typeof decoded.firebase?.sign_in_second_factor === 'string'
      ? decoded.firebase.sign_in_second_factor
      : undefined;
    const profile = await db.collection('usuarios').doc(decoded.uid).get();
    if (profile.exists) {
      // Seeded fixtures must never provide access to a production API.
      if (process.env['FUNCTIONS_EMULATOR'] !== 'true' && !process.env['FIREBASE_AUTH_EMULATOR_HOST']
        && profile.data()?.['seedTag'] === 'pilot-catalog-auth-v3-2026-09-30'
        && decoded.email?.toLowerCase().endsWith('@demo.cl')) {
        fail(res, 'AUTH_DEMO_ACCOUNT_DISABLED', 'Las cuentas de demostración no tienen acceso a esta aplicación.', 403);
        return;
      }
      if (profile.data()?.['estadoCuenta'] === 'bloqueado') {
        fail(res, 'AUTH_ACCOUNT_BLOCKED', 'Tu cuenta se encuentra bloqueada.', 403);
        return;
      }
      const role = profile.data()?.['rol'];
      if (role === 'maestro' || role === 'ferreteria' || role === 'admin') {
        req.authRole = role;
      }
      const requestPath = req.originalUrl || req.path;
      const privacyOperation = requestPath.includes('/privacy/')
        || requestPath.endsWith('/auth/session')
        || requestPath.endsWith('/auth/me')
        || requestPath.endsWith('/auth/register')
        || requestPath.endsWith('/auth/logout');
      if (profile.data()?.['tratamientoBloqueado'] === true && !privacyOperation) {
        fail(
          res,
          'PRIVACY_PROCESSING_BLOCKED',
          'El tratamiento de tus datos está temporalmente bloqueado. Solo puedes consultar tu centro de privacidad.',
          423
        );
        return;
      }
      if (!hasCurrentLegalAcceptance(profile.data()) && !privacyOperation) {
        fail(
          res,
          'LEGAL_ACCEPTANCE_REQUIRED',
          'Debes revisar y aceptar las versiones vigentes de los documentos legales.',
          428
        );
        return;
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

    if (role === 'admin' && process.env['REQUIRE_ADMIN_MFA'] === 'true' && !req.authSecondFactor) {
      fail(res, 'AUTH_ADMIN_MFA_REQUIRED', 'Debes usar el segundo factor para acceder al panel administrativo.', 403);
      return;
    }

    if (role === 'admin') {
      const actorId = req.authUserId;
      const method = req.method.toUpperCase();
      const path = (req.originalUrl || req.path).split('?')[0].slice(0, 500);
      const occurredAt = new Date().toISOString();

      // Persist the trace after Express has produced the final status. Bodies,
      // tokens and query strings are deliberately excluded from the audit log.
      res.once('finish', () => {
        void db.collection(COLLECTIONS.adminAuditLogs).add({
          actorId,
          actorRole: 'admin',
          action: `${method} ${path}`,
          method,
          path,
          statusCode: res.statusCode,
          outcome: res.statusCode < 400 ? 'success' : 'failure',
          occurredAt
        }).catch((error: unknown) => {
          console.error('admin_audit_write_failed', error);
        });
      });
    }

    next();
  };
}
