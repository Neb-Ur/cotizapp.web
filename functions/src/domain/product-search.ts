import { seoProductSlug } from './catalog-seo.js';
import { brandIdentity } from './brand-identity.js';
import type { PublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import type { ProjectProximity } from '../models/domain.models.js';
import { coordinateValue, geographicDistanceKm } from '../lib/values.js';

export type ProductSearchOptions = {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  familyId?: string;
  brand?: string;
  brandId?: string;
  proximity?: ProjectProximity;
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'stores';
  page: number;
  size: number;
};

// Search the shared master catalog, then attach the public offers available in
// the selected data mode/radius. Products without offers remain discoverable.
export function paginateProductSearch(snapshot: PublicCatalogSnapshot, options: ProductSearchOptions) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(\d)([a-z])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim();
  const query = normalize(options.query || '');
  const tokens = query.split(' ').filter(Boolean).map(word => word.length > 4 ? word.replace(/s$/, '') : word);
  const categories = new Map(snapshot.taxonomy.categories.map(item => [item.id, item.nombre]));
  const subcategories = new Map(snapshot.taxonomy.subcategories.map(item => [item.id, item.nombre]));
  const families = new Map(snapshot.taxonomy.families.map(item => [item.id, item.nombre]));
  const grouped = new Map<string, {
    seoPath:string;
    productoMaestroId: string;
    productName: string;
    imageUrl: string;
    fullImageUrl: string;
    imageFallbackUrl: string;
    minPrice: number;
    maxPrice: number;
    brand: string;
    productType: string;
    sellers: Set<string>;
    storeIds: Set<string>;
    nearestDistanceKm?: number;
  }>();

  for (const product of snapshot.products) {
    if (product.estado === 'inactivo') continue;
    const name = String(product.nombre || '');
    const text = normalize([name, product.marca, product.tipoProducto, categories.get(product.categoriaId), subcategories.get(product.subcategoriaId), families.get(product.familiaId)].filter(Boolean).join(' '));
    if (tokens.some(token => !text.includes(token))) continue;
    if (options.brandId && (product.marcaId || brandIdentity(product.marca)?.id) !== options.brandId) continue;
    if (!options.brandId && options.brand && normalize(String(product.marca || '')) !== normalize(options.brand)) continue;
    if (options.categoryId && product.categoriaId !== options.categoryId) continue;
    if (options.subcategoryId && product.subcategoriaId !== options.subcategoryId) continue;
    if (options.familyId && product.familiaId !== options.familyId) continue;
    grouped.set(product.id, {
      seoPath:'',
      productoMaestroId: product.id,
      productName: name,
      imageUrl: product.imagenMiniaturaUrl || product.imagenStorageUrl || (product.imagenPrincipalUrl && !product.imagenPrincipalUrl.includes('via.placeholder.com')
        ? product.imagenPrincipalUrl : ''),
      imageFallbackUrl: product.imagenExternaUrl || '',
      fullImageUrl: product.imagenStorageUrl || product.imagenPrincipalUrl || '',
      minPrice: 0,
      maxPrice: 0,
      brand: product.marca || 'Sin marca',
      productType: product.tipoProducto || product.descripcionCorta || 'Producto ferretero',
      sellers: new Set<string>(),
      storeIds: new Set<string>()
    });
  }

  for (const offer of snapshot.searchRows) {
    const current = grouped.get(offer.productoMaestroId);
    if (!current) continue;
    let distance: number | undefined;
    if (options.proximity) {
      const latitude = coordinateValue(offer.storeLatitude, -90, 90);
      const longitude = coordinateValue(offer.storeLongitude, -180, 180);
      if (latitude === null || longitude === null) continue;
      distance = geographicDistanceKm(options.proximity, { latitude, longitude });
      if (distance > options.proximity.radiusKm) continue;
    }
    current.minPrice = current.storeIds.size === 0 ? offer.price : Math.min(current.minPrice, offer.price);
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
    // No-offer references never appear as a fictitious cheapest price of $0.
    const availability = Number(b.storeCount > 0) - Number(a.storeCount > 0);
    if (availability) return availability;
    const order = options.sort === 'price-asc' ? a.minPrice - b.minPrice
      : options.sort === 'price-desc' ? b.minPrice - a.minPrice
      : b.storeCount - a.storeCount || a.minPrice - b.minPrice;
    return order || a.productName.localeCompare(b.productName) || a.productoMaestroId.localeCompare(b.productoMaestroId);
  });
  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / options.size));
  const page = Math.min(options.page, totalPages);
  return {
    items: results.slice((page - 1) * options.size, page * options.size).map(item=>({...item,seoPath:`/productos/${seoProductSlug(snapshot.products.find(p=>p.id===item.productoMaestroId),snapshot.products)}`})),
    page, size: options.size, total, totalPages, version: snapshot.version
  };
}
