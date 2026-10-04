/** Store prices are final, including VAT. This pure function is shared by API and UI. */
export interface Item { productName: string; quantity: number; storeId?: string; storeName?: string; productoFerreteriaId?: string; productoMaestroId?: string; }
export interface Offer { productName: string; storeName: string; storeId?: string; productoFerreteriaId?: string; productoMaestroId?: string; price: number; stock: number; comparisonEligible?: boolean; }
const productKey = (name: string) => name.trim().toLocaleLowerCase('es-CL');
const offerKey = (offer: Offer) => offer.productoFerreteriaId || `${offer.storeId || offer.storeName}:${productKey(offer.productName)}`;
const itemKey = (item: Item) => `${item.productoMaestroId || productKey(item.productName)}:${item.productoFerreteriaId || item.storeId || item.storeName || ''}`;
export function buildQuotationOptimization(items: Item[], offers: Offer[], selectedStoreName?: string) {
  const normalized = items.filter(item => item.productName.trim()).map(item => ({ ...item, productName: item.productName.trim(), quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)) }));
  const valid = offers.filter(offer => offer.comparisonEligible !== false && Number.isFinite(offer.price) && offer.price > 0 && Number.isFinite(offer.stock));
  function linesFor(store?: string) {
    const remaining = new Map(valid.map(offer => [offerKey(offer), Math.max(0, offer.stock)]));
    const chosen = new Map<string, Offer | undefined>();
    // Explicit selections reserve stock first. Repeated rows must fit together.
    const groups = new Map<string, typeof normalized>();
    for (const item of normalized) groups.set(itemKey(item), [...(groups.get(itemKey(item)) || []), item]);
    const hasSelection = (item: Item) => Boolean(item.storeId || item.storeName || item.productoFerreteriaId);
    for (const [key, group] of [...groups].sort((a, b) => Number(hasSelection(b[1][0])) - Number(hasSelection(a[1][0])))) {
      const item = group[0];
      const quantity = group.reduce((sum, row) => sum + row.quantity, 0);
      const offer = valid.filter(candidate => (item.productoMaestroId ? candidate.productoMaestroId === item.productoMaestroId : productKey(candidate.productName) === productKey(item.productName))
        && (!store || candidate.storeName === store)
        && (store || ((!item.storeId || candidate.storeId === item.storeId) && (!item.storeName || candidate.storeName === item.storeName) && (!item.productoFerreteriaId || candidate.productoFerreteriaId === item.productoFerreteriaId)))
        && (remaining.get(offerKey(candidate)) || 0) >= quantity).sort((a, b) => a.price - b.price)[0];
      chosen.set(key, offer);
      if (offer) remaining.set(offerKey(offer), (remaining.get(offerKey(offer)) || 0) - quantity);
    }
    return normalized.map(item => {
      const offer = chosen.get(itemKey(item));
      const unitPrice = offer?.price || 0;
      return { ...item, bestStoreName: offer?.storeName || 'Sin datos', unitPrice, subtotal: unitPrice * item.quantity, ...(offer?.productoFerreteriaId ? { productoFerreteriaId: offer.productoFerreteriaId } : {}) };
    });
  }
  const mixedLines = linesFor();
  const mixedTotal = mixedLines.reduce((sum, line) => sum + line.subtotal, 0);
  const singleStoreOptions = [...new Set(valid.map(offer => offer.storeName))].map(storeName => {
    const lines = linesFor(storeName);
    return lines.length && lines.every(line => line.bestStoreName !== 'Sin datos') ? { storeName, total: lines.reduce((sum, line) => sum + line.subtotal, 0) } : null;
  }).filter((row): row is { storeName: string; total: number } => row !== null).sort((a, b) => a.total - b.total);
  const appliedStore = singleStoreOptions.find(row => row.storeName === selectedStoreName);
  const lines = selectedStoreName ? linesFor(selectedStoreName) : mixedLines;
  const bestStore = appliedStore || singleStoreOptions[0] || { storeName: 'No disponible en una sola tienda', total: mixedTotal };
  return { lines, totalsByStore: singleStoreOptions, singleStoreOptions, bestStore, optimalTotal: lines.reduce((sum, line) => sum + line.subtotal, 0), mixedTotal, mixedSaving: lines.some(line => line.bestStoreName === 'Sin datos') || selectedStoreName ? 0 : Math.max(0, bestStore.total - mixedTotal), appliedStoreName: selectedStoreName || undefined };
}
