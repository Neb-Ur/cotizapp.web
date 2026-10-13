import { db } from './firebase.js';
import { COLLECTIONS } from './collections.js';
import { brandIdentity } from '../domain/brand-identity.js';
import { brandUses, type BrandUse } from '../domain/brand-use.js';

// A single stable identity per normalized name, even for concurrent product saves.
export async function resolveProductBrand(value: unknown): Promise<{ marca: string; marcaId: string | null }> {
  return resolveBrand(value, 'fabricante');
}
export async function resolveBrand(value: unknown, use: BrandUse): Promise<{ marca: string; marcaId: string | null }> {
  const identity = brandIdentity(value);
  if (!identity) return { marca: String(value ?? '').trim() || 'Sin marca', marcaId: null };
  const ref = db.collection(COLLECTIONS.brands).doc(identity.id);
  return db.runTransaction(async transaction => {
    let existing = await transaction.get(ref);
    if (!existing.exists) {
      const matches = await transaction.get(db.collection(COLLECTIONS.brands).where('nombreNormalizado', '==', identity.nombreNormalizado));
      if (!matches.empty) existing = matches.docs[0];
    }
    const target = existing.exists ? db.collection(COLLECTIONS.brands).doc(existing.id) : ref;
    if (!existing.exists) transaction.create(ref, { nombre: identity.nombre, nombreNormalizado: identity.nombreNormalizado, usos: [use], creadoEn: new Date().toISOString() });
    else if (!brandUses(existing.data()?.['usos']).includes(use)) transaction.update(target, { usos: [...brandUses(existing.data()?.['usos']), use], actualizadoEn: new Date().toISOString() });
    return { marca: existing.data()?.['nombre'] || identity.nombre, marcaId: target.id };
  });
}
