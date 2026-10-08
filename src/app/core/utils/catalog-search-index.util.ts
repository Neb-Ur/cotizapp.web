import { productSlug } from './product-url.util';
export interface SearchIndexOption { id: string; name: string; categoryId?: string; subcategoryId?: string; }
export interface SearchIndexProduct extends SearchIndexOption { path?:string; brand: string; brandId?: string | null; type: string; familyId: string; }
export interface SearchIndexSnapshot {
  brands?: SearchIndexOption[];
  schema: number; version: string; products: SearchIndexProduct[];
  categories: SearchIndexOption[]; subcategories: SearchIndexOption[]; families: SearchIndexOption[];
}
export type SuggestionKind = 'product' | 'category' | 'subcategory' | 'family' | 'brand';
export interface CatalogSuggestion { path?: string; id: string; kind: SuggestionKind; name: string; context: string; count?: number; queryParams?: Record<string, string>; }
export interface SuggestionGroup { label: string; kind: string; items: CatalogSuggestion[]; }
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/(\d)([a-z])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim();
const tokensOf = (query: string) => normalizeSearch(query).split(' ').filter(Boolean).map(word => word.length > 4 ? word.replace(/s$/, '') : word);
const usableBrand = (brand: string) => !!brand.trim() && !['sin marca', 'por especificar', 'generico', 'sin especificar'].includes(normalizeSearch(brand));

export function prepareCatalogIndex(snapshot: SearchIndexSnapshot) {
  const categories = new Map(snapshot.categories.map(item => [item.id, item]));
  const subcategories = new Map(snapshot.subcategories.map(item => [item.id, item]));
  const families = new Map(snapshot.families.map(item => [item.id, item]));
  const brandNames = new Map((snapshot.brands || []).map(item=>[item.id,item.name]));
  const products = snapshot.products.map(source => {
    const item = {...source, brand:brandNames.get(source.brandId || '') || source.brand};
    return ({ ...item, ownText: normalizeSearch(item.name),
    text: normalizeSearch([item.name, item.brand, item.type, categories.get(item.categoryId || '')?.name,
      subcategories.get(item.subcategoryId || '')?.name, families.get(item.familyId)?.name].filter(Boolean).join(' ')) }); });
  return (query: string): SuggestionGroup[] => {
    const tokens = tokensOf(query);
    if (normalizeSearch(query).length < 2 || !tokens.length) return [];
    const matches = (text: string) => tokens.every(token => text.includes(token));
    const rank = (name: string) => {
      const text = normalizeSearch(name);
      return text === normalizeSearch(query) ? 0 : text.startsWith(normalizeSearch(query)) ? 1 : matches(text) ? 2 : 3;
    };
    const matching = products.filter(item => matches(item.text)).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'es'));
    const productItems: CatalogSuggestion[] = matching.slice(0, 6).map(item => ({ id: item.id, kind: 'product', name: item.name, path:item.path,
      context: [families.get(item.familyId)?.name, usableBrand(item.brand) ? item.brand : 'Producto base'].filter(Boolean).join(' · ') }));
    function facets(options: SearchIndexOption[], kind: 'category' | 'subcategory' | 'family', key: 'categoryId' | 'subcategoryId' | 'familyId', limit: number): CatalogSuggestion[] {
      return options.map(item => ({item, count: matching.filter(product => product[key] === item.id).length}))
        .filter(({item, count}) => count > 0 || matches(normalizeSearch(item.name)))
        .sort((a, b) => rank(a.item.name) - rank(b.item.name) || b.count - a.count || a.item.name.localeCompare(b.item.name, 'es'))
        .slice(0, limit).map(({item, count}):CatalogSuggestion => {
          let queryParams:Record<string,string>;
          if(kind==='category') queryParams={categoria:item.id};
          else if(kind==='subcategory') queryParams={categoria:item.categoryId||'',subcategoria:item.id};
          else queryParams={familia:item.id,subcategoria:item.subcategoryId||'',categoria:subcategories.get(item.subcategoryId||'')?.categoryId||''};
          return {id:item.id,kind,name:item.name,count,queryParams, path:kind==='family'?`/familias/${productSlug(item.name)}`:kind==='category'?`/categorias/${productSlug(item.name)}`:undefined,
            context:kind==='category'?'Categoría':kind==='subcategory'?'Subcategoría':'Familia'};
        });
    }
    const matchingIds = new Set(matching.map(item=>item.id));
    const brands = new Map<string, {name: string; count: number; brandId?: string | null}>();
    for (const item of products) if (usableBrand(item.brand)) {
      const key = item.brandId || normalizeSearch(item.brand);
      const current = brands.get(key) || {name:item.brand,count:0,brandId:item.brandId};
      if (matchingIds.has(item.id)) current.count++;
      brands.set(key, current);
    }
    const brandItems: CatalogSuggestion[] = [...brands.entries()].filter(([,item]) => item.count > 0 || matches(normalizeSearch(item.name)))
      .sort((a,b)=>rank(a[1].name)-rank(b[1].name)||b[1].count-a[1].count).slice(0,3)
      .map(([id,item])=>({id,kind:'brand',name:item.name,path:`/marcas/${productSlug(item.name)}`,count:item.count,context:'Marca',queryParams:{marca:item.name,...(item.brandId ? {marcaId:item.brandId} : {})}}));
    return [ {label:'Productos',kind:'product',items:productItems},
      {label:'Familias',kind:'family',items:facets(snapshot.families,'family','familyId',3)},
      {label:'Marcas',kind:'brand',items:brandItems}
    ].filter(group=>group.items.length>0);
  };
}
