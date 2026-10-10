import { db } from '../lib/firebase.js';
import { rows, row } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from '../lib/collections.js';
import { storeCanPublish } from './pilot-stores.service.js';
import { normalizeText } from '../lib/values.js';

export const locationKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export function publicStore(store: any, owner: any) {
  return {
    id: store.id, name: normalizeText(store.nombreComercial),
    address: normalizeText(store.direccion || owner.direccion),
    region: normalizeText(store.region || owner.region),
    commune: normalizeText(store.comuna || owner.comuna),
    email: normalizeText(store.correoContactoPublico || owner.correo),
    phone: normalizeText(store.telefonoContactoPublico || owner.telefono),
    pilot: store.esPrueba === true
  };
}
export function ratingSummary(reviews: any[]) {
  const valid = reviews.filter(review => Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
  return { reviewCount: valid.length, rating: valid.length ? Math.round(valid.reduce((sum, review) => sum + review.rating, 0) / valid.length * 10) / 10 : null };
}
export async function directoryStores() {
  const [stores, users] = await Promise.all([rows(COLLECTIONS.stores), rows(COLLECTIONS.users)]);
  const owners = new Map(users.map(user => [user.id, user]));
  return stores.filter(store => storeCanPublish(store) && owners.get(store.usuarioDuenoId)?.estadoCuenta === 'activo')
    .map(store => publicStore(store, owners.get(store.usuarioDuenoId)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
}
export async function directoryStore(id: string) {
  const store = await row(COLLECTIONS.stores, id);
  if (!store || !storeCanPublish(store)) return null;
  const owner = await row(COLLECTIONS.users, store.usuarioDuenoId);
  return owner?.estadoCuenta === 'activo' ? publicStore(store, owner) : null;
}
export async function storeReviews(storeId: string) {
  const snapshot = await db.collection(COLLECTIONS.storeReviews).where('storeId', '==', storeId).get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as any[];
}
