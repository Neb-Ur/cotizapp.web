import type { Request, Response } from 'express';
import { row } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from './collections.js';
import { fail } from './http.js';
export function canAccessOwner(req: Request, ownerId: string): boolean {
  return req.authRole === 'admin' || req.authUserId === ownerId;
}

export async function storeOwnedBy(storeId: string, userId: string): Promise<boolean> {
  const store = await row(COLLECTIONS.stores, storeId);
  return !!store && store.usuarioDuenoId === userId;
}

export async function requireStoreWriteAccess(req: Request, res: Response, storeId: string): Promise<boolean> {
  if (req.authRole === 'admin') return true;
  if (!req.authUserId || req.authRole !== 'ferreteria') {
    fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para modificar esta ferreteria.', 403);
    return false;
  }
  if (!(await storeOwnedBy(storeId, req.authUserId))) {
    fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para modificar esta ferreteria.', 403);
    return false;
  }
  return true;
}

