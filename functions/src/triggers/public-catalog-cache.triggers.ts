import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { markPublicCatalogDirty } from '../lib/public-catalog-cache.js';

const region = 'southamerica-west1';

async function invalidate(): Promise<void> {
  await markPublicCatalogDirty();
}

export const publicCacheOnStoreProductWrite = onDocumentWritten(
  { document: 'productosFerreteria/{documentId}', region },
  invalidate
);

export const publicCacheOnMasterProductWrite = onDocumentWritten(
  { document: 'productosMaestro/{documentId}', region },
  invalidate
);

export const publicCacheOnCategoryWrite = onDocumentWritten(
  { document: 'categorias/{documentId}', region },
  invalidate
);

export const publicCacheOnSubcategoryWrite = onDocumentWritten(
  { document: 'subcategorias/{documentId}', region },
  invalidate
);

export const publicCacheOnFamilyWrite = onDocumentWritten(
  { document: 'familias/{documentId}', region },
  invalidate
);

export const publicCacheOnStoreWrite = onDocumentWritten(
  { document: 'ferreterias/{documentId}', region },
  invalidate
);

export const publicCacheOnUserWrite = onDocumentWritten(
  { document: 'usuarios/{documentId}', region },
  invalidate
);
