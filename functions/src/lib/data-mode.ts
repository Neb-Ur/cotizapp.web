import type { NextFunction, Request, Response } from 'express';
import { fail } from './http.js';

export function dataMode(): 'real' { return 'real'; }
const shared = new Set(['usuarios', 'categorias', 'subcategorias', 'familias', 'definicionesAtributoFamilia', 'productosMaestro', 'atributosProductoMaestro']);
export function collectionForMode(name: string): string {
  return shared.has(name) ? name : `real_${name}`;
}
export function profileBelongsToMode(profile: Record<string, unknown>): boolean {
  return profile['rol'] === 'admin' || !profile['dataMode'] || profile['dataMode'] === 'real';
}

export function dataModeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requested = req.header('X-Data-Mode');
  if (requested && requested !== 'real') {
    fail(res, 'DATA_MODE_INVALID', 'El entorno solicitado no está disponible.', 400);
    return;
  }
  if (req.header('Authorization')) {
    res.set('Cache-Control', 'private, no-store');
    const setHeader = res.setHeader.bind(res);
    res.setHeader = ((name: string, value: any) => setHeader(name, name.toLowerCase() === 'cache-control' ? 'private, no-store' : value)) as typeof res.setHeader;
  }
  res.vary('Authorization');
  res.set('X-Data-Mode', 'real');
  next();
}
