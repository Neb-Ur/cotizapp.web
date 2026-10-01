import type { ProjectItem, ProjectProximity } from '../models/domain.models.js';
import { normalizeText, numberValue, normalizeProjectProximity, geographicDistanceKm, nowIso } from '../lib/values.js';
import { buildSearchRows } from './catalog-search.service.js';
export function normalizeItems(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      productName: normalizeText(item?.productName),
      quantity: Math.max(1, Math.floor(numberValue(item?.quantity, 1)))
    }))
    .filter((item) => item.productName.length > 0);
}

export async function optimizeItems(
  items: ProjectItem[],
  proximity?: ProjectProximity | null,
  requestedStoreName?: string
): Promise<any> {
  const allSearchRows = await buildSearchRows();
  const searchRows = proximity
    ? allSearchRows.filter((item) => {
      if (item.storeLatitude === null || item.storeLongitude === null) return false;
      return geographicDistanceKm(
        { latitude: proximity.latitude, longitude: proximity.longitude },
        { latitude: item.storeLatitude, longitude: item.storeLongitude }
      ) <= proximity.radiusKm;
    })
    : allSearchRows;

  const normalized = normalizeItems(items);

  const mixedLines = normalized.map((item) => {
    const candidates = searchRows
      .filter((offer) =>
        offer.productName.toLowerCase() === item.productName.toLowerCase()
        && offer.stock >= item.quantity
      )
      .sort((a, b) => a.price - b.price);
    const best = candidates[0];
    const unitPrice = best?.price || 0;
    return {
      productName: item.productName,
      quantity: item.quantity,
      bestStoreName: best?.storeName || 'Sin datos',
      unitPrice,
      subtotal: unitPrice * item.quantity,
      productoFerreteriaId: best?.productoFerreteriaId || null
    };
  });

  const mixedTotal = mixedLines.reduce((acc, item) => acc + item.subtotal, 0);
  const selectedStoreNames = Array.from(new Set(
    mixedLines
      .map((item) => item.bestStoreName)
      .filter((storeName) => storeName && storeName !== 'Sin datos')
  ));

  const singleStoreOptions = selectedStoreNames
    .map((storeName) => {
      let total = 0;
      for (const item of normalized) {
        const offer = searchRows
          .filter((candidate) =>
            candidate.storeName === storeName
            && candidate.productName.toLowerCase() === item.productName.toLowerCase()
            && candidate.stock >= item.quantity
          )
          .sort((a, b) => a.price - b.price)[0];

        if (!offer) return null;
        total += offer.price * item.quantity;
      }
      return { storeName, total };
    })
    .filter((item): item is { storeName: string; total: number } => item !== null)
    .sort((a, b) => a.total - b.total);

  const requested = normalizeText(requestedStoreName);
  const appliedStore = requested
    ? singleStoreOptions.find((item) => item.storeName === requested)
    : undefined;

  const lines = appliedStore
    ? normalized.map((item) => {
      const offer = searchRows
        .filter((candidate) =>
          candidate.storeName === appliedStore.storeName
          && candidate.productName.toLowerCase() === item.productName.toLowerCase()
          && candidate.stock >= item.quantity
        )
        .sort((a, b) => a.price - b.price)[0];
      const unitPrice = offer?.price || 0;
      return {
        productName: item.productName,
        quantity: item.quantity,
        bestStoreName: offer ? appliedStore.storeName : 'Sin datos',
        unitPrice,
        subtotal: unitPrice * item.quantity,
        productoFerreteriaId: offer?.productoFerreteriaId || null
      };
    })
    : mixedLines;

  const optimalTotal = lines.reduce((acc, item) => acc + item.subtotal, 0);
  const bestStore = appliedStore
    || singleStoreOptions[0]
    || { storeName: 'Sin tienda unica disponible', total: mixedTotal };

  return {
    lines,
    totalsByStore: singleStoreOptions,
    singleStoreOptions,
    bestStore,
    optimalTotal,
    mixedTotal,
    mixedSaving: appliedStore ? 0 : Math.max(0, bestStore.total - mixedTotal),
    appliedStoreName: appliedStore?.storeName
  };
}

export async function projectView(project: any): Promise<any> {
  const items = normalizeItems(project.items);
  const proximity = normalizeProjectProximity(project.proximity ?? project.proximidad);
  const requestedStoreName = normalizeText(project.singleStoreName ?? project.ferreteriaUnica);
  const optimization = await optimizeItems(items, proximity, requestedStoreName);
  return {
    id: project.id,
    name: project.name || project.nombre || 'Cotizacion',
    address: project.address || project.direccionObra || '',
    proximity: proximity || undefined,
    singleStoreName: optimization.appliedStoreName || undefined,
    createdAt: project.createdAt || project.creadoEn || nowIso(),
    items,
    totalOptimal: optimization.optimalTotal,
    saving: optimization.mixedSaving
  };
}

