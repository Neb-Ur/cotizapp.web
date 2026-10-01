import { randomUUID } from 'node:crypto';
import { db } from '../lib/firebase.js';
export async function rows(collectionName: string): Promise<any[]> {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function row(collectionName: string, id: string): Promise<any | null> {
  const snapshot = await db.collection(collectionName).doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createRow(collectionName: string, payload: Record<string, unknown>, id = randomUUID()): Promise<any> {
  await db.collection(collectionName).doc(id).set(payload);
  return { id, ...payload };
}

export async function patchRow(collectionName: string, id: string, payload: Record<string, unknown>): Promise<any | null> {
  const ref = db.collection(collectionName).doc(id);
  const current = await ref.get();
  if (!current.exists) return null;
  await ref.update(payload);
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

export async function deleteRowsByIds(collectionName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = db.batch();
    ids.slice(offset, offset + 400).forEach((id) => batch.delete(db.collection(collectionName).doc(id)));
    await batch.commit();
  }
}

