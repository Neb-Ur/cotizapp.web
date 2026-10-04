import { buildQuotationOptimization } from '../domain/quotation.js';
import type { ProjectItem, ProjectProximity } from '../models/domain.models.js';
import { normalizeText, numberValue, normalizeProjectProximity, geographicDistanceKm, nowIso } from '../lib/values.js';
import { buildSearchRows } from './catalog-search.service.js';
export function normalizeItems(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      productName: normalizeText(item?.productName),
      quantity: Math.max(1, Math.floor(numberValue(item?.quantity, 1))),
      ...(normalizeText(item?.productoMaestroId) ? { productoMaestroId: normalizeText(item.productoMaestroId) } : {}),
      ...(normalizeText(item?.storeId) ? { storeId: normalizeText(item.storeId) } : {}),
      ...(normalizeText(item?.storeName) ? { storeName: normalizeText(item.storeName) } : {}),
      ...(normalizeText(item?.productoFerreteriaId) ? { productoFerreteriaId: normalizeText(item.productoFerreteriaId) } : {})
    }))
    .filter((item) => item.productName.length > 0);
}

export async function optimizeItems(
  items: ProjectItem[],
  proximity?: ProjectProximity | null,
  requestedStoreName?: string,
  existingOffers?: Awaited<ReturnType<typeof buildSearchRows>>
): Promise<any> {
  const allSearchRows = existingOffers || await buildSearchRows();
  const searchRows = proximity
    ? allSearchRows.filter((item) => {
      if (item.storeLatitude === null || item.storeLongitude === null) return false;
      return geographicDistanceKm(
        { latitude: proximity.latitude, longitude: proximity.longitude },
        { latitude: item.storeLatitude, longitude: item.storeLongitude }
      ) <= proximity.radiusKm;
    })
    : allSearchRows;

  return buildQuotationOptimization(normalizeItems(items), searchRows, requestedStoreName);
}

export async function projectView(project: any, offers?: Awaited<ReturnType<typeof buildSearchRows>>): Promise<any> {
  const items = normalizeItems(project.items);
  const proximity = normalizeProjectProximity(project.proximity ?? project.proximidad);
  const requestedStoreName = normalizeText(project.singleStoreName ?? project.ferreteriaUnica);
  const optimization = await optimizeItems(items, proximity, requestedStoreName, offers);
  return {
    id: project.id,
    name: project.name || project.nombre || 'Cotizacion',
    address: project.address || project.direccionObra || '',
    proximity: proximity || undefined,
    singleStoreName: optimization.appliedStoreName || undefined,
    createdAt: project.createdAt || project.creadoEn || nowIso(),
    items,
    availabilityStatus: items.length === 0 ? 'draft' : optimization.lines.some((line: any) => line.unitPrice <= 0) ? 'incomplete' : 'ready',
    pricesCheckedAt: nowIso(),
    pricingMode: 'live',
    totalOptimal: optimization.optimalTotal,
    saving: optimization.mixedSaving
  };
}

