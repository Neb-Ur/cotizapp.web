import type { Offer } from './quotation.js';
const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;
const key = (offer: Offer) => offer.productoFerreteriaId || `${offer.storeId || offer.storeName}:${offer.productName.trim().toLowerCase()}`;
export function quotationExpired(project: any, now = Date.now()): boolean {
  return !!project.validUntil && Date.parse(project.validUntil) <= now;
}
export function captureQuotationPricing(project: any, previous: any, offers: Offer[], now = Date.now(), renew = false) {
  const saved: Offer[] = !renew && Array.isArray(previous?.pricingOffers) ? previous.pricingOffers : [];
  const matches = (offer: Offer) => (project.items || []).some((item: any) => item.productoMaestroId
    ? offer.productoMaestroId === item.productoMaestroId
    : offer.productName.trim().toLowerCase() === String(item.productName).trim().toLowerCase());
  const capturedProducts = new Set(saved.map(o => o.productoMaestroId || o.productName.trim().toLowerCase()));
  // Existing products retain all saved prices. Only newly added products obtain current offers.
  const additions = offers.filter(o => matches(o) && !capturedProducts.has(o.productoMaestroId || o.productName.trim().toLowerCase()));
  const unique = new Map([...saved, ...additions].map(o => [key(o), o]));
  return {
    pricingOffers: [...unique.values()],
    pricesCapturedAt: !renew && previous?.pricesCapturedAt || new Date(now).toISOString(),
    validUntil: !renew && previous?.validUntil || new Date(now + TEN_DAYS).toISOString(),
    pricingMode: 'snapshot'
  };
}
