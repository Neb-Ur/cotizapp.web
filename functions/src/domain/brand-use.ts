export const BRAND_USES = ['fabricante'] as const;
export type BrandUse = typeof BRAND_USES[number];
export function brandUses(value: unknown): BrandUse[] {
  return Array.isArray(value) ? BRAND_USES.filter(use => value.includes(use)) : ['fabricante'];
}
export function validBrandUses(value: unknown): value is BrandUse[] {
  return Array.isArray(value) && value.length > 0 && value.every(use => (BRAND_USES as readonly unknown[]).includes(use)) && new Set(value).size === value.length;
}
