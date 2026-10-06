import { rows } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from './collections.js';
import { dataMode } from './data-mode.js';
import { buildSearchRows } from '../services/catalog-search.service.js';
import { randomUUID } from 'node:crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from './legal.js';
import { storeAgreementDocumentHash } from '../services/store-agreement.service.js';

export type PublicSearchRow = import('../models/domain.models.js').SearchRow;

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



const META_ID = 'meta';
const CHUNK_SIZE = 150;
const CACHE_POLICY = `data-modes-v1:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}`;
const MAX_AGE_MS = 60_000;
function fresh(meta: any): boolean {
  return meta?.policy === CACHE_POLICY && Date.now() - Date.parse(meta.updatedAt || '') < MAX_AGE_MS;
}
const rebuildPromises = new Map<string, Promise<PublicCatalogSnapshot>>();
const memorySnapshots = new Map<string, PublicCatalogSnapshot>();

function rememberSnapshot(snapshot: PublicCatalogSnapshot): PublicCatalogSnapshot {
  memorySnapshots.set(dataMode(), snapshot);
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


function chunk<T>(items: T[], size: number = CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
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
      tipoProducto: item.tipoProducto || '',
      unidadVenta: item.unidadVenta || '',
      presentacion: item.presentacion || '',
      marca: item.marca || 'Sin marca',
      descripcionCorta: item.descripcionCorta || '',
      descripcionLarga: item.descripcionLarga || '',
      imagenPrincipalUrl: item.imagenPrincipalUrl || '',
      galeriaJson: Array.isArray(item.galeriaJson) ? item.galeriaJson : [],
      catalogoNivel: item.catalogoNivel || 'producto_comercial',
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

  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(metaRef);
    const latestGeneration = Number(latest.data()?.generation || 0);
    if (latestGeneration !== generation) return;

    transaction.set(metaRef, {
      generation,
      builtGeneration: generation,
      dirty: false,
      policy: CACHE_POLICY,
      version,
      updatedAt,
      taxonomyDocId,
      offerDocIds,
      productDocIds
    }, { merge: true });
  });

  const snapshot: PublicCatalogSnapshot = {
    version,
    updatedAt,
    taxonomy,
    products: activeProducts,
    searchRows
  };


  // Keep a grace period so concurrent readers retain their published chunks.
  const expired = await db.collection(COLLECTIONS.publicCache).where('updatedAt', '<', new Date(Date.now() - 3_600_000).toISOString()).limit(400).get();
  const obsolete = expired.docs.filter(doc => doc.id !== META_ID);
  if (obsolete.length) {
    const batch = db.batch();
    obsolete.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  return snapshot;
}

async function rebuildPublicCatalogCache(): Promise<PublicCatalogSnapshot> {
  const mode = dataMode();
  const existing = rebuildPromises.get(mode);
  if (existing) return existing;

  const rebuildPromise = (async () => {
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

  rebuildPromises.set(mode, rebuildPromise);
  try {
    return await rebuildPromise;
  } finally {
    rebuildPromises.delete(mode);
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
    version: meta.dirty === true || !fresh(meta)
      ? `dirty-${generation}-${publishedVersion || 'none'}`
      : publishedVersion,
    updatedAt: String(meta.updatedAt || meta.invalidatedAt || '')
  };
}

export async function getPublicCatalogSnapshot(
  options: { allowStale?: boolean; expectedVersion?: string } = {}
): Promise<PublicCatalogSnapshot> {
  const metaRef = db.collection(COLLECTIONS.publicCache).doc(META_ID);
  const metaSnapshot = await metaRef.get();
  const meta = metaSnapshot.exists ? metaSnapshot.data() as any : null;

  if (meta?.version && meta?.taxonomyDocId && meta.dirty === false && fresh(meta)) {
    const memorySnapshot = memorySnapshots.get(dataMode());
    if (memorySnapshot?.version === String(meta.version)) return memorySnapshot;
    return readPublishedSnapshot(meta);
  }
  return rememberSnapshot(await rebuildPublicCatalogCache());
}
