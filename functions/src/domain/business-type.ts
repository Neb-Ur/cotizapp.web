export const BUSINESS_TYPES = ['ferreteria', 'repuestos', 'desarmaduria'] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];
export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}
export function normalizeBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : 'ferreteria';
}
export function categoryMatchesBusinessType(categoryId: unknown, businessType: unknown): boolean {
  const automotive = categoryId === 'cat-repuestos-automotrices';
  return normalizeBusinessType(businessType) === 'ferreteria' ? !automotive : automotive;
}
export function businessTypeLabel(value: unknown): string {
  const labels: Record<BusinessType, string> = { ferreteria: 'Ferretería', repuestos: 'Tienda de repuestos', desarmaduria: 'Desarmaduría' };
  return labels[normalizeBusinessType(value)];
}

export const PRODUCT_BUSINESS_SCOPES = ['ferreteria', 'desarmaduria', 'ambos'] as const;
export type ProductBusinessScope = typeof PRODUCT_BUSINESS_SCOPES[number];
export function isProductBusinessScope(value: unknown): value is ProductBusinessScope {
  return typeof value === 'string' && (PRODUCT_BUSINESS_SCOPES as readonly string[]).includes(value);
}
export function normalizeProductBusinessScope(value: unknown, categoryId?: unknown): ProductBusinessScope {
  return isProductBusinessScope(value) ? value : categoryId === 'cat-repuestos-automotrices' ? 'desarmaduria' : 'ferreteria';
}
export function productMatchesBusinessType(product: {ambitoComercial?: unknown; categoriaId?: unknown}, businessType: unknown): boolean {
  const scope = normalizeProductBusinessScope(product.ambitoComercial, product.categoriaId);
  return scope === 'ambos' || scope === (normalizeBusinessType(businessType) === 'ferreteria' ? 'ferreteria' : 'desarmaduria');
}
export function productBusinessScopeLabel(value: unknown, categoryId?: unknown): string {
  return {ferreteria:'Ferretería',desarmaduria:'Desarmaduría',ambos:'Ambos'}[normalizeProductBusinessScope(value, categoryId)];
}
