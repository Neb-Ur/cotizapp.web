import {
  ProjectItem,
  ProjectQuotationLine,
  ProjectQuotationView,
  ProjectStoreTotal
} from '../models/app.models';

export interface QuotationOffer {
  productName: string;
  storeName: string;
  price: number;
  stock: number;
}

export function buildQuotationOptimization(
  items: ProjectItem[],
  offers: QuotationOffer[],
  selectedStoreName?: string
): ProjectQuotationView {
  const normalizedItems = items
    .filter((item) => item.productName.trim())
    .map((item) => ({
      productName: item.productName.trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));

  const mixedLines = normalizedItems.map((item) => buildBestLine(item, offers));
  const mixedTotal = mixedLines.reduce((sum, line) => sum + line.subtotal, 0);

  const selectedStoreNames = Array.from(new Set(
    mixedLines
      .map((line) => line.bestStoreName)
      .filter((storeName) => storeName && storeName !== 'Sin datos')
  ));

  const singleStoreOptions = selectedStoreNames
    .map((storeName) => buildSingleStoreOption(storeName, normalizedItems, offers))
    .filter((row): row is ProjectStoreTotal => row !== null)
    .sort((left, right) => left.total - right.total);

  const appliedStore = selectedStoreName
    ? singleStoreOptions.find((row) => row.storeName === selectedStoreName)
    : undefined;

  const lines = appliedStore
    ? normalizedItems.map((item) => buildStoreLine(item, offers, appliedStore.storeName))
    : mixedLines;

  const activeTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const bestStore = appliedStore
    || singleStoreOptions[0]
    || { storeName: 'No disponible en una sola tienda', total: mixedTotal };

  return {
    lines,
    totalsByStore: singleStoreOptions,
    singleStoreOptions,
    bestStore,
    optimalTotal: activeTotal,
    mixedTotal,
    mixedSaving: appliedStore ? 0 : Math.max(0, bestStore.total - mixedTotal),
    appliedStoreName: appliedStore?.storeName
  };
}

function buildBestLine(
  item: { productName: string; quantity: number },
  offers: QuotationOffer[]
): ProjectQuotationLine {
  const best = offers
    .filter((offer) =>
      sameProduct(offer.productName, item.productName)
      && offer.stock >= item.quantity
    )
    .sort((left, right) => left.price - right.price)[0];

  const unitPrice = best?.price || 0;
  return {
    productName: item.productName,
    quantity: item.quantity,
    bestStoreName: best?.storeName || 'Sin datos',
    unitPrice,
    subtotal: unitPrice * item.quantity
  };
}

function buildStoreLine(
  item: { productName: string; quantity: number },
  offers: QuotationOffer[],
  storeName: string
): ProjectQuotationLine {
  const offer = offers
    .filter((candidate) =>
      candidate.storeName === storeName
      && sameProduct(candidate.productName, item.productName)
      && candidate.stock >= item.quantity
    )
    .sort((left, right) => left.price - right.price)[0];

  const unitPrice = offer?.price || 0;
  return {
    productName: item.productName,
    quantity: item.quantity,
    bestStoreName: offer ? storeName : 'Sin datos',
    unitPrice,
    subtotal: unitPrice * item.quantity
  };
}

function buildSingleStoreOption(
  storeName: string,
  items: Array<{ productName: string; quantity: number }>,
  offers: QuotationOffer[]
): ProjectStoreTotal | null {
  let total = 0;

  for (const item of items) {
    const offer = offers
      .filter((candidate) =>
        candidate.storeName === storeName
        && sameProduct(candidate.productName, item.productName)
        && candidate.stock >= item.quantity
      )
      .sort((left, right) => left.price - right.price)[0];

    if (!offer) return null;
    total += offer.price * item.quantity;
  }

  return { storeName, total };
}

function sameProduct(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
