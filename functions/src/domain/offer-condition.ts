export const OFFER_CONDITIONS = ['sin_especificar', 'nuevo', 'usado', 'reacondicionado', 'para_reparar'] as const;
export type OfferCondition = typeof OFFER_CONDITIONS[number];
export function isOfferCondition(value: unknown): value is OfferCondition {
  return typeof value === 'string' && (OFFER_CONDITIONS as readonly string[]).includes(value);
}
export function normalizeOfferCondition(value: unknown): OfferCondition {
  return isOfferCondition(value) ? value : 'sin_especificar';
}
export function offerConditionLabel(value: unknown): string {
  const labels: Record<OfferCondition, string> = { sin_especificar: 'Sin especificar', nuevo: 'Nuevo', usado: 'Usado', reacondicionado: 'Reacondicionado', para_reparar: 'Para reparar' };
  return labels[normalizeOfferCondition(value)];
}
