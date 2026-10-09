import { buildQuotationOptimization, type Item, type Offer } from './quotation.js';
import { geographicDistanceKm } from '../lib/values.js';
export const ACTIVE_QUOTATION_DAYS = 30;
type Row = Record<string, any>;
export interface StoreDailyAnalytics {
  schema: 1; computedAt: string; activeWindowDays: number;
  quotationCount: number; quotedLines: number; quotedUnits: number; quotedProducts: number;
  activeQuotationCount: number; activeQuotedUnits: number; activeQuotedAmount: number;
  recentQuotationCount: number; previousQuotationCount: number;
  views: number; selections: number;
  catalog: { total: number; published: number; inStock: number; outOfStock: number; stalePrices: number };
  topProducts: Array<{ productId: string; name: string; quotationCount: number; units: number; activeAmount: number; stock: number }>;
}
/** Only aggregate counts and product data leave this calculation; never customer data or quotation IDs. */
export function aggregateStoreDailyAnalytics(stores: Row[], projects: Row[], offers: (Offer & Row)[], catalog: Row[], products: Row[], events: Row[], now = new Date()): Map<string, StoreDailyAnalytics> {
  const day = 86400_000, cutoff = now.getTime() - ACTIVE_QUOTATION_DAYS * day;
  const productById = new Map(products.map(product => [product.id, product]));
  const rawOfferById = new Map(catalog.map(offer => [offer.id, offer]));
  const offersByProduct = new Map<string, (Offer & Row)[]>();
  for (const offer of offers) {
    for (const key of [`id:${offer.productoMaestroId}`, `name:${offer.productName.trim().toLocaleLowerCase('es-CL')}`]) offersByProduct.set(key, [...(offersByProduct.get(key) || []), offer]);
  }
  const result = new Map<string, StoreDailyAnalytics>();
  const ranks = new Map<string, Map<string, StoreDailyAnalytics['topProducts'][number] & { quoteIds: Set<string> }>>();
  const catalogByStore = new Map<string, Row[]>();
  for (const offer of catalog) catalogByStore.set(offer.ferreteriaId, [...(catalogByStore.get(offer.ferreteriaId) || []), offer]);
  for (const store of stores) {
    const entries = catalogByStore.get(store.id) || [];
    const published = entries.filter(offer => offer.activo !== false && offer.publicado !== false && productById.has(offer.productoMaestroId) && productById.get(offer.productoMaestroId)?.estado !== 'inactivo');
    const event = events.find(row => row.id === store.id);
    result.set(store.id, { schema: 1, computedAt: now.toISOString(), activeWindowDays: ACTIVE_QUOTATION_DAYS,
      quotationCount: 0, quotedLines: 0, quotedUnits: 0, quotedProducts: 0, activeQuotationCount: 0, activeQuotedUnits: 0, activeQuotedAmount: 0,
      recentQuotationCount: 0, previousQuotationCount: 0, views: Number(event?.views || 0), selections: Number(event?.selections || 0),
      catalog: { total: entries.length, published: published.length, inStock: published.filter(offer => Number(offer.stock) > 0).length,
        outOfStock: published.filter(offer => Number(offer.stock) <= 0).length,
        stalePrices: published.filter(offer => !offer.actualizadoEn || Date.parse(offer.actualizadoEn) < cutoff).length }, topProducts: [] });
    ranks.set(store.id, new Map());
  }
  const legacyStore = (name: string) => { const matches = stores.filter(store => (store.nombreComercial || store.nombre) === name); return matches.length === 1 ? matches[0].id : undefined; };
  for (const [index, project] of projects.entries()) {
    if (['cancelled', 'deleted', 'cancelado', 'eliminado'].includes(project.status || project.estado)) continue;
    const items: Item[] = (Array.isArray(project.items) ? project.items : []).filter((item: any) => typeof item.productName === 'string' && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0);
    if (!items.length) continue;
    const quoteId = String(project.id || index);
    const updated = Date.parse(project.updatedAt || project.createdAt || '');
    const created = Date.parse(project.createdAt || '');
    const active = updated >= cutoff && updated <= now.getTime() && !['closed', 'archived', 'cerrado', 'archivado'].includes(project.status || project.estado);
    const candidates = [...new Map(items.flatMap(item => offersByProduct.get(item.productoMaestroId ? `id:${item.productoMaestroId}` : `name:${item.productName.trim().toLocaleLowerCase('es-CL')}`) || []).map(offer => [offer.productoFerreteriaId || `${offer.storeId}:${offer.productName}`, offer])).values()];
    const proximity = project.proximity;
    const scoped = proximity ? candidates.filter(offer => Number.isFinite(offer.storeLatitude) && Number.isFinite(offer.storeLongitude) && geographicDistanceKm(proximity, {latitude: offer.storeLatitude, longitude: offer.storeLongitude}) <= Number(proximity.radiusKm)) : candidates;
    const singleId = project.singleStoreId || (project.singleStoreName ? legacyStore(project.singleStoreName) : undefined);
    const optimized = buildQuotationOptimization(items, Array.isArray(project.pricingOffers) ? project.pricingOffers : scoped, project.singleStoreName, singleId);
    const touched = new Set<string>();
    for (const line of optimized.lines) {
      const originalOffer = rawOfferById.get(line.productoFerreteriaId || '');
      // An explicitly selected unavailable product is still demand for that store; its amount is zero.
      const storeId = line.bestStoreId || singleId || (project.singleStoreName ? undefined : line.storeId || originalOffer?.ferreteriaId || (line.storeName ? legacyStore(line.storeName) : undefined));
      const metrics = result.get(storeId); if (!metrics) continue;
      touched.add(storeId); metrics.quotedLines++; metrics.quotedUnits += line.quantity;
      if (active) { metrics.activeQuotedUnits += line.quantity; metrics.activeQuotedAmount += line.subtotal; }
      const productId = line.productoMaestroId || originalOffer?.productoMaestroId || line.productName.trim().toLocaleLowerCase('es-CL');
      const ranking = ranks.get(storeId)!;
      const product = ranking.get(productId) || {productId, name: productById.get(productId)?.nombre || line.productName, quotationCount: 0, units: 0, activeAmount: 0,
        stock: (catalogByStore.get(storeId) || []).filter(offer => offer.productoMaestroId === productId).reduce((total, offer) => total + Math.max(0, Number(offer.stock) || 0), 0), quoteIds: new Set<string>()};
      product.quoteIds.add(quoteId); product.units += line.quantity; product.activeAmount += active ? line.subtotal : 0; ranking.set(productId, product);
    }
    for (const storeId of touched) {
      const metrics = result.get(storeId)!; metrics.quotationCount++;
      if (active) metrics.activeQuotationCount++;
      if (created >= now.getTime() - 7 * day && created <= now.getTime()) metrics.recentQuotationCount++;
      else if (created >= now.getTime() - 14 * day && created < now.getTime() - 7 * day) metrics.previousQuotationCount++;
    }
  }
  for (const [storeId, metrics] of result) {
    const ranking = ranks.get(storeId)!; metrics.quotedProducts = ranking.size;
    metrics.topProducts = [...ranking.values()].map(({quoteIds, ...product}) => ({...product, quotationCount: quoteIds.size}))
      .sort((left, right) => right.quotationCount - left.quotationCount || right.units - left.units || left.name.localeCompare(right.name, 'es')).slice(0, 20);
  }
  return result;
}
