export const BUSINESS_TYPES = ['ferreteria', 'repuestos', 'desarmaduria'] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];
export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}
export function normalizeBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : 'ferreteria';
}
export function businessTypeLabel(value: unknown): string {
  const labels: Record<BusinessType, string> = { ferreteria: 'Ferretería', repuestos: 'Tienda de repuestos', desarmaduria: 'Desarmaduría' };
  return labels[normalizeBusinessType(value)];
}
