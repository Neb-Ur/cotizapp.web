import { rows } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from '../lib/collections.js';
import { coordinateValue, inferMeasurementFromLabel, normalizeText, numberValue, pricePerMeasurement } from '../lib/values.js';
import type { SearchRow } from '../models/domain.models.js';
import { storeCanPublish } from './pilot-stores.service.js';
export async function buildSearchRows(source?: any[][], asOf?:number): Promise<SearchRow[]> {
  const [offers, products, stores, users, categories, subcategories, families] = source || await Promise.all([
    rows(COLLECTIONS.storeProducts),
    rows(COLLECTIONS.masterProducts),
    rows(COLLECTIONS.stores),
    rows(COLLECTIONS.users),
    rows(COLLECTIONS.categories),
    rows(COLLECTIONS.subcategories),
    rows(COLLECTIONS.families)
  ]);

  const referenceTime=asOf ?? Date.now();
  const productById = new Map(products.map((item) => [item.id, item]));
  const storeById = new Map(stores.map((item) => [item.id, item]));
  const userById = new Map(users.map((item) => [item.id, item]));
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const subcategoryById = new Map(subcategories.map((item) => [item.id, item]));
  const familyById = new Map(families.map((item) => [item.id, item]));

  return offers
    .filter((offer) => offer.activo !== false && offer.publicado !== false)
    .filter((offer) => !offer.vigenteDesde || new Date(offer.vigenteDesde).getTime() <= referenceTime)
    .filter((offer) => !offer.vigenteHasta || new Date(offer.vigenteHasta).getTime() > referenceTime)
    .map((offer) => {
      const product = productById.get(offer.productoMaestroId);
      const store = storeById.get(offer.ferreteriaId);
      const owner = store ? userById.get(store.usuarioDuenoId) : null;
      if (
        !product
        || !store
        || !owner
        || product.estado === 'inactivo'
        || !storeCanPublish(store)
        || owner.estadoCuenta !== 'activo'
      ) return null;

      const price = numberValue(offer.precio);
      if (price <= 0) return null;
      const declaredMeasurementUnit = ['kg', 'l', 'm', 'm2', 'm3', 'unidad'].includes(offer.unidadMedidaPrecio)
        ? offer.unidadMedidaPrecio as 'kg' | 'l' | 'm' | 'm2' | 'm3' | 'unidad'
        : null;
      const declaredMeasurementQuantity = numberValue(offer.cantidadMedida, 0) > 0
        ? numberValue(offer.cantidadMedida)
        : null;
      const inferredMeasurement = !declaredMeasurementUnit || !declaredMeasurementQuantity
        ? inferMeasurementFromLabel(product.nombre)
        : null;
      const measurementUnit = declaredMeasurementUnit || inferredMeasurement?.unit || null;
      const measurementQuantity = declaredMeasurementQuantity || inferredMeasurement?.quantity || null;
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
        storeRut: normalizeText(store.rut),
        storeEmail: normalizeText(store.correoContactoPublico || owner.correo).toLowerCase(),
        storePhone: normalizeText(store.telefonoContactoPublico || owner.telefono),
        price,
        priceUpdatedAt: normalizeText(offer.actualizadoEn || offer.creadoEn),
        includesVat: true as boolean,
        comparisonEligible: price > 0 && numberValue(offer.stock) > 0,
        includesShipping: false as boolean,
        validFrom: normalizeText(offer.vigenteDesde || offer.actualizadoEn || offer.creadoEn),
        validUntil: normalizeText(offer.vigenteHasta) || null,
        offerConditions: normalizeText(offer.condicionesOferta)
          || 'Precio sujeto a stock y confirmación directa con la ferretería.',
        sponsored: offer.patrocinado === true,
        measurementUnit,
        measurementQuantity,
        pricePerMeasurement: measurementUnit ? pricePerMeasurement(price, measurementQuantity) : null,
        measurementSource: declaredMeasurementUnit && declaredMeasurementQuantity
          ? 'store_reported'
          : inferredMeasurement ? 'catalog_presentation' : null,
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
