import {
  ProjectItem,
  ProjectQuotationView
} from '../models/app.models';

export interface QuotationOffer {
  productName: string;
  storeName: string;
  price: number;
  stock: number;
}

export function buildQuotationOptimization(
  items: ProjectItem[],
  offers: QuotationOffer[]
): ProjectQuotationView {
  const normalizedItems = items
    .filter((item) => item.productName.trim())
    .map((item) => ({
      productName: item.productName.trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    }));

  const lines = normalizedItems.map((item) => {
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
  });

  const optimalTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const storeNames = Array.from(new Set(offers.map((offer) => offer.storeName)));

  const totalsByStore = storeNames
    .map((storeName) => {
      let total = 0;

      for (const item of normalizedItems) {
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
    })
    .filter((row): row is { storeName: string; total: number } => row !== null)
    .sort((left, right) => left.total - right.total);

  const bestStore = totalsByStore[0] || {
    storeName: 'No disponible en una sola tienda',
    total: optimalTotal
  };

  return {
    lines,
    totalsByStore,
    bestStore,
    optimalTotal,
    mixedSaving: Math.max(0, bestStore.total - optimalTotal)
  };
}

function sameProduct(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
