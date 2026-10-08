import { db } from './firebase.js';
import { COLLECTIONS } from './collections.js';
import { brandIdentity } from '../domain/brand-identity.js';

// A single stable identity per normalized name, even for concurrent product saves.
export async function resolveProductBrand(value: unknown): Promise<{ marca: string; marcaId: string | null }> {
  const identity = brandIdentity(value);
  if (!identity) return { marca: String(value ?? '').trim() || 'Sin marca', marcaId: null };
  const ref = db.collection(COLLECTIONS.brands).doc(identity.id);
  return db.runTransaction(async transaction => {
    const existing = await transaction.get(ref);
    if (!existing.exists) transaction.create(ref, { nombre: identity.nombre, nombreNormalizado: identity.nombreNormalizado, creadoEn: new Date().toISOString() });
    return { marca: existing.data()?.['nombre'] || identity.nombre, marcaId: identity.id };
  });
}
