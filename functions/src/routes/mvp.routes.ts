import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Router, type Request, type Response } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';

export const mvpRouter = Router();

type UserRole = 'maestro' | 'ferreteria' | 'admin';
type ProjectStatus = 'pendiente' | 'aceptada' | 'rechazada';

type ProjectItem = {
  productName: string;
  quantity: number;
};

type SearchRow = {
  productoMaestroId: string;
  productoFerreteriaId: string;
  productName: string;
  storeName: string;
  storeId: string;
  price: number;
  distanceKm: number;
  balanceScore: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
  stock: number;
  sku: string;
};

const COLLECTIONS = {
  users: 'usuarios',
  stores: 'ferreterias',
  categories: 'categorias',
  subcategories: 'subcategorias',
  families: 'familias',
  familyDefinitions: 'definicionesAtributoFamilia',
  masterProducts: 'productosMaestro',
  masterAttributes: 'atributosProductoMaestro',
  storeProducts: 'productosFerreteria',
  projects: 'proyectos',
  productRequests: 'solicitudesCreacionProducto'
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validRole(value: unknown): value is UserRole {
  return value === 'maestro' || value === 'ferreteria' || value === 'admin';
}

async function rows(collectionName: string): Promise<any[]> {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function row(collectionName: string, id: string): Promise<any | null> {
  const snapshot = await db.collection(collectionName).doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function createRow(collectionName: string, payload: Record<string, unknown>, id = randomUUID()): Promise<any> {
  await db.collection(collectionName).doc(id).set(payload);
  return { id, ...payload };
}

async function patchRow(collectionName: string, id: string, payload: Record<string, unknown>): Promise<any | null> {
  const ref = db.collection(collectionName).doc(id);
  const current = await ref.get();
  if (!current.exists) return null;
  await ref.update(payload);
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

async function deleteRowsByIds(collectionName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = db.batch();
    ids.slice(offset, offset + 400).forEach((id) => batch.delete(db.collection(collectionName).doc(id)));
    await batch.commit();
  }
}

function canAccessOwner(req: Request, ownerId: string): boolean {
  return req.authRole === 'admin' || req.authUserId === ownerId;
}

async function storeOwnedBy(storeId: string, userId: string): Promise<boolean> {
  const store = await row(COLLECTIONS.stores, storeId);
  return !!store && store.usuarioDuenoId === userId;
}

async function requireStoreWriteAccess(req: Request, res: Response, storeId: string): Promise<boolean> {
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

async function authUserResponse(userId: string): Promise<any | null> {
  const user = await row(COLLECTIONS.users, userId);
  if (!user) return null;
  const stores = await rows(COLLECTIONS.stores);
  const store = stores.find((item) => item.usuarioDuenoId === userId);
  return {
    ...user,
    ferreteriaId: store?.id,
    nombreComercial: store?.nombreComercial,
    rut: store?.rut ?? user.rut
  };
}

async function buildSearchRows(): Promise<SearchRow[]> {
  const [offers, products, stores, categories, subcategories, families] = await Promise.all([
    rows(COLLECTIONS.storeProducts),
    rows(COLLECTIONS.masterProducts),
    rows(COLLECTIONS.stores),
    rows(COLLECTIONS.categories),
    rows(COLLECTIONS.subcategories),
    rows(COLLECTIONS.families)
  ]);

  const productById = new Map(products.map((item) => [item.id, item]));
  const storeById = new Map(stores.map((item) => [item.id, item]));
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const subcategoryById = new Map(subcategories.map((item) => [item.id, item]));
  const familyById = new Map(families.map((item) => [item.id, item]));

  return offers
    .filter((offer) => offer.activo !== false && offer.publicado !== false)
    .map((offer) => {
      const product = productById.get(offer.productoMaestroId);
      const store = storeById.get(offer.ferreteriaId);
      if (!product || !store || product.estado === 'inactivo' || store.estado === 'inactivo') return null;

      const price = numberValue(offer.precio);
      return {
        productoMaestroId: product.id,
        productoFerreteriaId: offer.id,
        productName: product.nombre,
        storeName: store.nombreComercial,
        storeId: store.id,
        price,
        distanceKm: 0,
        balanceScore: price,
        categoryId: product.categoriaId,
        categoryName: categoryById.get(product.categoriaId)?.nombre || 'Sin categoria',
        subcatego