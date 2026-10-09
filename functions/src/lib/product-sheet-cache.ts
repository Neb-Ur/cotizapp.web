import { seoProductSlug } from '../domain/catalog-seo.js';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { COLLECTIONS } from './collections.js';
import { rows } from '../repositories/firestore.repository.js';
import { dataMode } from './data-mode.js';

// Product sheets are independent of prices, stock and commercial agreements.
const TTL = 5 * 60_000;
const catalogs = new Map<string, { expires: number; request: Promise<any> }>();
const revisions = new Map<string, number>();
const sheets = new Map<string, { expires: number; request: Promise<any> }>();
const slugOf = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

export async function getStaticCatalog(): Promise<any[][]> {
  const mode = dataMode();
  const revisionDoc = await db.collection(COLLECTIONS.publicCache).doc('catalog-revision').get();
  const revision = Number(revisionDoc.data()?.revision || 0);
  if (revisions.get(mode) !== revision) { catalogs.delete(mode); sheets.clear(); revisions.set(mode, revision); }
  let catalog = catalogs.get(mode);
  if (!catalog || catalog.expires <= Date.now()) {
    const request = Promise.all([
      rows(COLLECTIONS.masterProducts), rows(COLLECTIONS.categories),
      rows(COLLECTIONS.subcategories), rows(COLLECTIONS.families), rows(COLLECTIONS.brands)
    ]);
    catalog = { expires: Date.now() + TTL, request };
    catalogs.set(mode, catalog);
    void request.catch(() => { if (catalogs.get(mode)?.request === request) catalogs.delete(mode); });
  }
  return catalog.request;
}

export async function getProductSheet(name: string, slug: string): Promise<any | null> {
  const mode = dataMode();
  const [products, categories, subcategories, families] = await getStaticCatalog();
  const product = products.find((item: any) => item.estado !== 'inactivo' && (slug
    ? seoProductSlug(item,products) === slug : String(item.nombre).trim().toLowerCase() === name));
  if (!product) return null;
  const key = `${mode}:${product.id}`;
  let sheet = sheets.get(key);
  if (!sheet || sheet.expires <= Date.now()) {
    const request = (async () => {
      const [attributes, definitions] = await Promise.all([
        db.collection(COLLECTIONS.masterAttributes).where('productoMaestroId', '==', product.id).get(),
        db.collection(COLLECTIONS.familyDefinitions).where('familiaId', '==', product.familiaId).get()
      ]);
      const labels = new Map(definitions.docs.map(doc => [doc.id, doc.data()['etiqueta']]));
      // Explicit public fields; internal review and rights records are never cached in the browser.
      const fields = ['id', 'nombre', 'categoriaId', 'subcategoriaId', 'familiaId', 'marca', 'marcaId', 'tipoProducto',
        'unidadVenta', 'presentacion', 'descripcionCorta', 'descripcionLarga', 'imagenPrincipalUrl', 'imagenStorageUrl', 'imagenExternaUrl', 'galeriaJson', 'origenImagen', 'catalogoNivel', 'caracteristicasDestacadas'];
      return {
        productoMaestro: {...Object.fromEntries(fields.filter(field => product[field] !== undefined).map(field => [field, product[field]])),seoPath:`/productos/${seoProductSlug(product,products)}`},
        categoryName: categories.find((item: any) => item.id === product.categoriaId)?.nombre || 'Sin categoria',
        subcategoryName: subcategories.find((item: any) => item.id === product.subcategoriaId)?.nombre || 'Sin subcategoria',
        familyName: families.find((item: any) => item.id === product.familiaId)?.nombre || 'Sin familia',
        atributosProducto: attributes.docs.map(doc => {
          const item = doc.data();
          return { ...item, etiqueta: labels.get(item['definicionAtributoId']) || item['definicionAtributoId'] };
        })
      };
    })();
    sheet = { expires: Math.min(catalogs.get(mode)?.expires || Date.now(), Date.now() + TTL), request };
    sheets.set(key, sheet);
    void request.catch(() => { if (sheets.get(key)?.request === request) sheets.delete(key); });
  }
  return sheet.request;
}

export async function invalidateStaticCatalog(): Promise<void> {
  catalogs.clear(); sheets.clear();
  await db.collection(COLLECTIONS.publicCache).doc('catalog-revision').set({revision: FieldValue.increment(1)}, {merge: true});
}

export function staticCatalogRevision(): number { return revisions.get(dataMode()) || 0; }
