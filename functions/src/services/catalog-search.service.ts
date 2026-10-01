import { rows } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from '../lib/collections.js';
import { coordinateValue, normalizeText, numberValue } from '../lib/values.js';
import type { SearchRow } from '../models/domain.models.js';
export async function buildSearchRows(): Promise<SearchRow[]> {
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
        || owner.estadoCuenta !== 'activo'
      ) return null;

      const price = numberValue(offer.precio);
      return {
        productoMaestroId: product.id,
        productoFerreteriaId: offer.id,
        productName: product.nombre,
        storeName: store.nombreComercial,
        storeId: store.id,
        storeLatitude: coordinateValue(store.latitud, -90, 90),
        storeLongitude: coordinateValue(store.longitud, -180, 180),
        storeAddress: normalizeText(owner.direccion),
        storeCommune: normalizeText(owner.comuna),
        price,
        categoryId: product.categoriaId,
        categoryName: categoryById.get(product.categoriaId)?.nombre || 'Sin categoria',
        subcategoryId: product.subcategoriaId,
        subcategoryName: subcategoryById.get(product.subcategoriaId)?.nombre || 'Sin subcategoria',
        familyId: product.familiaId,
        familyName: familyById.get(product.familiaId)?.nombre || 'Sin familia',
        stock: numberValue(offer.stock),
        sku: offer.skuFerreteria || ''
      } satisfies SearchRow;
    })
    .filter((item): item is SearchRow => item !== null);
}

