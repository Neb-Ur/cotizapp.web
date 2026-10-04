import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { adminAuth, db } from './firebase.js';
import { fail } from './http.js';

export type DataMode = 'demo' | 'real';
const context = new AsyncLocalStorage<DataMode>();
export function defaultDataMode(): DataMode {
  const value = process.env['DEMO'] ?? 'false';
  if (value !== 'true' && value !== 'false') throw new Error('DEMO debe ser true o false.');
  return value === 'true' ? 'demo' : 'real';
}
export function dataMode(): DataMode { return context.getStore() ?? defaultDataMode(); }
export function withDataMode<T>(mode: DataMode, work: () => T): T { return context.run(mode, work); }
const shared = new Set(['usuarios', 'categorias', 'subcategorias', 'familias', 'definicionesAtributoFamilia', 'productosMaestro', 'atributosProductoMaestro']);
export function collectionForMode(name: string, mode = dataMode()): string {
  return shared.has(name) || mode === 'demo' ? name : `real_${name}`;
}
export function profileBelongsToMode(profile: Record<string, unknown>, mode = dataMode()): boolean {
  return profile['rol'] === 'admin' || (profile['dataMode'] ?? 'demo') === mode;
}

// Run before any router so every asynchronous Firestore operation uses the
// same realm. An override is a privilege, never a trusted client preference.
export async function dataModeMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requested = req.header('X-Data-Mode');
  let mode = defaultDataMode();
  if (requested) {
    if (requested !== 'demo' && requested !== 'real') { fail(res, 'DATA_MODE_INVALID', 'El entorno solicitado no es válido.', 400); return; }
    try {
      const token = req.header('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) { fail(res, 'DATA_MODE_FORBIDDEN', 'Solo el administrador puede cambiar de entorno.', 403); return; }
      const identity = await adminAuth.verifyIdToken(token, true);
      const profile = (await db.collection('usuarios').doc(identity.uid).get()).data();
      if (!profile || profile['rol'] !== 'admin' || profile['estadoCuenta'] === 'bloqueado'
        || (process.env['REQUIRE_ADMIN_MFA'] === 'true' && !identity.firebase?.sign_in_second_factor)) {
        fail(res, 'DATA_MODE_FORBIDDEN', 'Solo un administrador activo puede cambiar de entorno.', 403); return;
      }
      mode = requested;
    } catch { fail(res, 'AUTH_INVALID_TOKEN', 'Token inválido o expirado.', 401); return; }
    // Private responses must not be reused by a CDN across administrators or realms.
    res.set('Cache-Control', 'private, no-store');
    const setHeader = res.setHeader.bind(res);
    res.setHeader = ((name: string, value: any) => setHeader(name, name.toLowerCase() === 'cache-control' ? 'private, no-store' : value)) as typeof res.setHeader;
  }
  res.vary('X-Data-Mode'); res.vary('Authorization');
  res.set('X-Data-Mode', mode);
  if (mode === 'demo') res.set('X-Robots-Tag', 'noindex, nofollow');
  context.run(mode, next);
}

/** Legacy demo seed becomes a generic catalog template in the real view. */
export function catalogProductForMode<T extends Record<string, any>>(product: T): T {
  if (dataMode() === 'real' && product['seedTag'] === 'pilot-catalog-auth-v3-2026-09-30'
    && /Ficha demostrativa|generados para pruebas/i.test(String(product['descripcionLarga'] || ''))) {
    return { ...product, marca: 'Genérico', descripcionLarga: product['descripcionCorta'] || `${product['nombre']}. Consulta la presentación y características con la ferretería.` };
  }
  return product;
}
