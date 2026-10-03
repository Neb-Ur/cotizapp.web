import { randomUUID } from 'node:crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from './legal.js';
import { storeAgreementDocumentHash } from '../services/store-agreement.service.js';

export type PublicSearchRow = {
  productoMaestroId: string;
  productoFerreteriaId: string;
  productName: string;
  storeName: string;
  storeId: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
  storeAddress: string;
  storeCommune: string;
  price: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
  stock: number;
  sku: string;
};

export type PublicCatalogSnapshot = {
  version: string;
  updatedAt: string;
  taxonomy: {
    categories: any[];
    subcategories: any[];
    families: any[];
  };
  products: any[];
  searchRows: PublicSearchRow[];
};

const COLLECTIONS = {
  users: 'usuarios',
  stores: 'ferreterias',
  categories: 'categorias',
  subcategories: 'subcategorias',
  families: 'familias',
  masterProducts: 'productosMaestro',
  storeProducts: 'productosFerreteria',
  publicCache: 'cachePublico'
} as const;

const META_ID = 'meta';
const CHUNK_SIZE = 150;
let rebuildPromise: Promise<PublicCatalogSnapshot> | null = null;
let memorySnapshot: PublicCatalogSnapshot | null = null;

function rememberSnapshot(snapshot: PublicCatalogSnapshot): PublicCatalogSnapshot {
  memorySnapshot = snapshot;
  return snapshot;
}

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

function coordinateValue(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

async function rows(collectionName: string): Promise<any[]> {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function buildSearchRows(): Promise<PublicSearchRow[]> {
  const [offers, products, stores, users, categories, subcategories, families] = await Promise.all([
    rows(COLLECTIONS.storeProducts),
    rows(COLLECTIONS.masterProducts),
    rows(COLLECTIONS.stores),
    rows(COLLECTIONS.users),
    rows(COLLECTIONS.categories),
    rows(COLLECTIONS.subcategories),
    rows(COLLECTIONS.families)
  ]);

  const productById = new Map(products.map((item) => [item.id, item]));
  const storeById = new Map(stores.map((item) => [item.id, item]));
  const userById = new Map(users.map((item) => [item.id, item]));
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const subcategoryById = new Map(subcategories.map((item) => [item.id, item]));
  const familyById = new Map(families.map((item) => [item.id, item]));

  return offers
    .filter((offer) => offer.activo !== false && offer.publicado !== false)
    .map((offer) => {
      const product = productById.get(offer.productoMaestroId);
      const store = storeById.get(offer.ferreteriaId);
      const owner = store ? userById.get(store.usuarioDuenoId) : null;

      if (
        !product
        || !store
        || !owner
        || product.estado === 'inactivo'
        || store.estado === 'inactivo'
        || store.contratoEstado !== 'vigente'
        || store.contratoVersion !== CURRENT_STORE_AGREEMENT_VERSION
        || store.contratoDocumentHash !== storeAgreementDocumentHash()
        || owner.estadoCuenta !== 'activo'
      ) {
        return null;
      }

      return {
        productoMaestroId: product.id,
        productoFerreteriaId: offer.id,
        productName: normalizeText(product.nombre),
        storeName: normalizeText(store.nombreComercial),
        storeId: store.id,
        storeLatitude: coordinateValue(store.latitud, -90, 90),
        storeLongitude: coordinateValue(store.longitud, -180, 180),
        storeAddress: normalizeText(owner.direccion),
        storeCommune: normalizeText(owner.comuna),
        price: numberValue(offer.precio),
        categoryId: normalizeText(product.categoriaId),
        categoryName: normalizeText(categoryById.get(product.categoriaId)?.nombre) || 'Sin categoria',
        subcategoryId: normalizeText(product.subcategoriaId),
        subcategoryName: normalizeText(subcategoryById.get(product.subcategoriaId)?.nombre) || 'Sin subcategoria',
        familyId: normalizeText(product.familiaId),
        familyName: normalizeText(familyById.get(product.familiaId)?.nombre) || 'Sin familia',
        stock: numberValue(offer.stock),
        sku: normalizeText(offer.skuFerreteria)
      } satisfies PublicSearchRow;
    })
    .filter((item): item is PublicSearchRow => item !== null)
    .sort((a, b) => a.price - b.price);
}

function chunk<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < items.length; offset += CHUNK_SIZE) {
    result.push(items.slice(offset, offset + CHUNK_SIZE));
  }
  return result;
}

async function writeChunkDocuments(
  writes: Array<{ id: string; data: Record<string, unknown> }>
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    writes.slice(offset, offset + 400).forEach((write) => {
      batch.set(db.collection(COLLECTIONS.publicCache).doc(write.id), write.data);
    });
    await batch.commit();
  }
}

async function materializeSnapshot(): Promise<PublicCatalogSnapshot> {
  const metaRef = db.collection(COLLECTIONS.publicCache).doc(META_ID);
  const metaBefore = await metaRef.get();
  const generation = Number(metaBefore.data()?.generation || 0);

  const [searchRows, products, categories, subcategories, families] = await Promise.all([
    buildSearchRows(),
    rows(COLLECTIONS.masterProducts),
    rows(COLLECTIONS.categories),
    rows(COLLECTIONS.subcategories),
    rows(COLLECTIONS.families)
  ]);

  const activeProducts = products
    .filter((item) => item.estado !== 'inactivo')
    .map((item) => ({
      id: item.id,
      categoriaId: item.categoriaId,
      subcategoriaId: item.subcategoriaId,
      familiaId: item.familiaId,
      nombre: item.nombre,
      marca: item.marca || 'Sin marca',
      descripcionCorta: item.descripcionCorta || '',
      descripcionLarga: item.descripcionLarga || '',
      imagenPrincipalUrl: item.imagenPrincipalUrl || '',
      galeriaJson: Array.isArray(item.galeriaJson) ? item.galeriaJson : [],
      estado: item.estado || 'activo'
    }))
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));

  const taxonomy = {
    categories: categories.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre))),
    subcategories: subcategories.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre))),
    families: families.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)))
  };

  const version = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const updatedAt = nowIso();
  const offerChunks = chunk(searchRows);
  const productChunks = chunk(activeProducts);
  const taxonomyDocId = `taxonomy-${version}`;
  const offerDocIds = offerChunks.map((_, index) => `offers-${version}-${String(index).padStart(4, '0')}`);
  const productDocIds = productChunks.map((_, index) => `products-${version}-${String(index).padStart(4, '0')}`);

  await writeChunkDocuments([
    {
      id: taxonomyDocId,
      data: { version, updatedAt, ...taxonomy }
    },
    ...offerChunks.map((items, index) => ({
      id: offerDocIds[index],
      data: { version, updatedAt, items }
    })),
    ...productChunks.map((items, index) => ({
      id: productDocIds[index],
      data: { version, updatedAt, items }
    }))
  ]);

  let published = false;
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(metaRef);
    const latestGeneration = Number(latest.data()?.generation || 0);
    if (latestGeneration !== generation) return;

    transaction.set(metaRef, {
      generation,
      builtGeneration: generation,
      dirty: false,
      version,
      updatedAt,
      taxonomyDocId,
      offerDocIds,
      productDocIds
    }, { merge: true });
    published = true;
  });

  const snapshot: PublicCatalogSnapshot = {
    version,
    updatedAt,
    taxonomy,
    products: activeProducts,
    searchRows
  };

  if (published) {
    const keepIds = new Set([META_ID, taxonomyDocId, ...offerDocIds, ...productDocIds]);
    const existing = await db.collection(COLLECTIONS.publicCache).get();
    const obsolete = existing.docs.filter((doc) => !keepIds.has(doc.id));
    for (let offset = 0; offset < obsolete.length; offset += 400) {
      const batch = db.batch();
      obsolete.slice(offset, offset + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  return snapshot;
}

async function rebuildPublicCatalogCache(): Promise<PublicCatalogSnapshot> {
  if (rebuildPromise) return rebuildPromise;

  rebuildPromise = (async () => {
    let latest: PublicCatalogSnapshot | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      latest = await materializeSnapshot();
      const meta = await db.collection(COLLECTIONS.publicCache).doc(META_ID).get();
      const data = meta.data();
      if (data && data.dirty === false && data.version === latest.version) {
        return rememberSnapshot(latest);
      }
    }

    if (!latest) throw new Error('No fue posible construir el cache publico.');
    return latest;
  })();

  try {
    return await rebuildPromise;
  } finally {
    rebuildPromise = null;
  }
}

async function readPublishedSnapshot(meta: any): Promise<PublicCatalogSnapshot> {
  const taxonomyRef = db.collection(COLLECTIONS.publicCache).doc(String(meta.taxonomyDocId));
  const offerRefs: DocumentReference[] = (Array.isArray(meta.offerDocIds) ? meta.offerDocIds : [])
    .map((id: unknown) => db.collection(COLLECTIONS.publicCache).doc(String(id)));
  const productRefs: DocumentReference[] = (Array.isArray(meta.productDocIds) ? meta.productDocIds : [])
    .map((id: unknown) => db.collection(COLLECTIONS.publicCache).doc(String(id)));

  const [taxonomySnapshot, offerSnapshots, productSnapshots] = await Promise.all([
    taxonomyRef.get(),
    Promise.all(offerRefs.map((ref) => ref.get())),
    Promise.all(productRefs.map((ref) => ref.get()))
  ]);

  if (
    !taxonomySnapshot.exists
    || offerSnapshots.some((snapshot) => !snapshot.exists)
    || productSnapshots.some((snapshot) => !snapshot.exists)
  ) {
    throw new Error('Cache publico incompleto.');
  }

  const taxonomy = taxonomySnapshot.data() as any;
  return rememberSnapshot({
    version: String(meta.version),
    updatedAt: String(meta.updatedAt || ''),
    taxonomy: {
      categories: Array.isArray(taxonomy?.categories) ? taxonomy.categories : [],
      subcategories: Array.isArray(taxonomy?.subcategories) ? taxonomy.subcategories : [],
      families: Array.isArray(taxonomy?.families) ? taxonomy.families : []
    },
    products: productSnapshots.flatMap((snapshot) => {
      const data = snapshot.data() as any;
      return Array.isArray(data?.items) ? data.items : [];
    }),
    searchRows: offerSnapshots.flatMap((snapshot) => {
      const data = snapshot.data() as any;
      return Array.isArray(data?.items) ? data.items as PublicSearchRow[] : [];
    })
  });
}

export async function markPublicCatalogDirty(): Promise<void> {
  const metaRef = db.collection(COLLECTIONS.publicCache).doc(META_ID);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(metaRef);
    const currentGeneration = Number(snapshot.data()?.generation || 0);
    transaction.set(metaRef, {
      generation: currentGeneration + 1,
      dirty: true,
      invalidatedAt: nowIso()
    }, { merge: true });
  });
}

export async function getPublicCatalogMetadata(): Promise<{ version: string; updatedAt: string }> {
  const metaSnapshot = await db.collection(COLLECTIONS.publicCache).doc(META_ID).get();
  const meta = metaSnapshot.exists ? metaSnapshot.data() as any : null;

  if (!meta) {
    return { version: '', updatedAt: '' };
  }

  const publishedVersion = String(meta.version || '');
  const generation = Number(meta.generation || 0);
  return {
    version: meta.dirty === true
      ? `dirty-${generation}-${publishedVersion || 'none'}`
      : publishedVersion,
    updatedAt: String(meta.updatedAt || meta.invalidatedAt || '')
  };
}

export async function getPublicCatalogSnapshot(
  options: { allowStale?: boolean; expectedVersion?: string } = {}
): Promise<PublicCatalogSnapshot> {
  if (memorySnapshot) {
    if (options.allowStale && !options.expectedVersion) {
      return memorySnapshot;
    }
    if (options.expectedVersion && options.expectedVersion === memorySnapshot.version) {
      return memorySnapshot;
    }
  }

  const metaRef = db.collection(COLLECTIONS.publicCache).doc(META_ID);
  const metaSnapshot = await metaRef.get();
  const meta = metaSnapshot.exists ? metaSnapshot.data() as any : null;

  let publishedSnapshot: PublicCatalogSnapshot | null = null;
  if (meta?.version && meta?.taxonomyDocId) {
    if (
      memorySnapshot?.version === String(meta.version)
      && (meta.dirty === false || options.allowStale)
    ) {
      return memorySnapshot;
    }

    try {
      publishedSnapshot = await readPublishedSnapshot(meta);
      if (meta.dirty === false || options.allowStale) {
        return publishedSnapshot;
      }
    } catch {
      publishedSnapshot = null;
    }
  }

  try {
    return rememberSnapshot(await rebuildPublicCatalogCache());
  } catch (error) {
    if (publishedSnapshot) {
      return publishedSnapshot;
    }
    throw error;
  }
}
