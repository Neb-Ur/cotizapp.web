/** Trovio's active market is hardware, tools and construction materials.
 * Reject stale records while old browser caches expire and the purge is rolled out.
 */
export const AUTOMOTIVE_CATEGORY_ID = 'cat-repuestos-automotrices';
export function isHardwareProduct(product: { categoriaId?: unknown; categoryId?: unknown; ambitoComercial?: unknown }): boolean {
  return (product.categoriaId ?? product.categoryId) !== AUTOMOTIVE_CATEGORY_ID && product.ambitoComercial !== 'desarmaduria';
}
export function isHardwareStore(store: { tipoNegocio?: unknown; businessType?: unknown }): boolean {
  const type = store.tipoNegocio ?? store.businessType;
  return !type || type === 'ferreteria';
}
export function hardwareTaxonomy(categories: any[], subcategories: any[], families: any[]) {
  const excludedSubcategories = new Set(subcategories.filter(item => item.categoriaId === AUTOMOTIVE_CATEGORY_ID).map(item => item.id));
  return {
    categories: categories.filter(item => item.id !== AUTOMOTIVE_CATEGORY_ID),
    subcategories: subcategories.filter(item => !excludedSubcategories.has(item.id)),
    families: families.filter(item => !excludedSubcategories.has(item.subcategoriaId))
  };
}
export function hardwareCatalog([products, categories, subcategories, families, brands]: any[][]): any[][] {
  const taxonomy = hardwareTaxonomy(categories, subcategories, families);
  return [products.filter(isHardwareProduct), taxonomy.categories, taxonomy.subcategories, taxonomy.families,
    brands.filter(brand => !Array.isArray(brand.usos) || (brand.usos.includes('fabricante') && (!brand.usos.includes('vehiculo') || products.some(product => isHardwareProduct(product) && product.marcaId === brand.id))))];
}
export function hardwareSnapshot<T extends { products: any[]; searchRows: any[]; taxonomy: { categories: any[]; subcategories: any[]; families: any[] } }>(snapshot: T): T {
  const products = snapshot.products.filter(isHardwareProduct);
  const ids = new Set(products.map(product => product.id));
  return { ...snapshot, products, searchRows: snapshot.searchRows.filter(row => ids.has(row.productoMaestroId) && isHardwareProduct(row)),
    taxonomy: hardwareTaxonomy(snapshot.taxonomy.categories, snapshot.taxonomy.subcategories, snapshot.taxonomy.families) };
}
