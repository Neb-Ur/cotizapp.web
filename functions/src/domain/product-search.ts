import type { PublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import type { ProjectProximity } from '../models/domain.models.js';
import { coordinateValue, geographicDistanceKm } from '../lib/values.js';

export type ProductSearchOptions = {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  familyId?: string;
  proximity?: ProjectProximity;
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'stores';
  page: number;
  size: number;
};

// Filter and aggregate all eligible public offers before slicing a page. The
// snapshot is already isolated by data mode and enforces publication rules.
export function paginateProductSearch(snapshot: PublicCatalogSnapshot, options: ProductSearchOptions) {
  const products = new Map(snapshot.products.map(product => [product.id, product]));
  const query = (options.query || '').trim().toLowerCase();
  const grouped = new Map<string, {
    productoMaestroId: string;
    productName: string;
    imageUrl: string;
    minPrice: number;
    maxPrice: number;
    brand: string;
    productType: string;
    sellers: Set<string>;
    storeIds: Set<string>;
    nearestDistanceKm?: number;
  }>();

  for (const offer of snapshot.searchRows) {
    if (query && !offer.productName.toLowerCase().includes(query)) continue;
    if (options.categoryId && offer.categoryId !== options.categoryId) continue;
    if (options.subcategoryId && offer.subcategoryId !== options.subcategoryId) continue;
    if (options.familyId && offer.familyId !== options.familyId) continue;
    let distance: number | undefined;
    if (options.proximity) {
      const latitude = coordinateValue(offer.storeLatitude, -90, 90);
      const longitude = coordinateValue(offer.storeLongitude, -180, 180);
      if (latitude === null || longitude === null) continue;
      distance = geographicDistanceKm(options.proximity, { latitude, longitude });
      if (distance > options.proximity.radiusKm) continue;
    }
    const product = products.get(offer.productoMaestroId);
    const current = grouped.get(offer.productoMaestroId) || {
      productoMaestroId: offer.productoMaestroId,
      productName: offer.productName,
      imageUrl: product?.imagenPrincipalUrl && !product.imagenPrincipalUrl.includes('via.placeholder.com')
        ? product.imagenPrincipalUrl : '',
      minPrice: offer.price,
      maxPrice: offer.price,
      brand: product?.marca || 'Sin marca',
      productType: product?.descripcionCorta || 'Producto ferretero',
      sellers: new Set<string>(),
      storeIds: new Set<string>(),
      nearestDistanceKm: distance
    };
    current.minPrice = Math.min(current.minPrice, offer.price);
    current.maxPrice = Math.max(current.maxPrice, offer.price);
    current.sellers.add(offer.storeName);
    current.storeIds.add(offer.storeId);
    if (distance !== undefined) current.nearestDistanceKm = Math.min(current.nearestDistanceKm ?? distance, distance);
    grouped.set(offer.productoMaestroId, current);
  }

  const results = Array.from(grouped.values()).map(({ storeIds, sellers, ...product }) => ({
    ...product, storeCount: storeIds.size, sellers: Array.from(sellers)
  }));
  results.sort((a, b) => {
    const order = options.sort === 'price-asc' ? a.minPrice - b.minPrice
      : options.sort === 'price-desc' ? b.minPrice - a.minPrice
      : b.storeCount - a.storeCount || a.minPrice - b.minPrice;
    return order || a.productName.localeCompare(b.productName) || a.productoMaestroId.localeCompare(b.productoMaestroId);
  });
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / options.size));
  const page = Math.min(options.page, totalPages);
  return {
    items: results.slice((page - 1) * options.size, page * options.size),
    page, size: options.size, total, totalPages, version: snapshot.version
  };
}
