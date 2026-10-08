import { createHash } from 'node:crypto';
import { brandIdentity } from './brand-identity.js';
export const SITE_URL = 'https://cotizapp-d71c8.web.app';
export const seoSlug = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
export function seoProductSlug(product:any, products:any[]):string {
  const slug=seoSlug(product.nombre);
  const matches=products.filter(p=>p.estado!=='inactivo' && seoSlug(p.nombre)===slug).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return matches.length>1 && matches[0].id!==product.id ? `${slug.slice(0,109)}-${createHash('sha256').update(String(product.id)).digest('hex').slice(0,8)}` : slug;
}
export interface CatalogLanding {
  path: string; name: string; title: string; description: string;
  filters: Record<string, string>; products: any[];
}
export function catalogLandings([allProducts, categories, subcategories, families, brands]: any[][]): CatalogLanding[] {
  const products = allProducts.filter(p => p.estado !== 'inactivo');
  const result: CatalogLanding[] = [];
  function add(kind: string, name: string, filters: Record<string,string>, items: any[]) {
    if (!items.length || !seoSlug(name)) return;
    const path = `/${kind}/${seoSlug(name)}`;
    // Distinct pages with the same human name must not silently share a canonical URL.
    const existing = result.find(p => p.path === path);
    const uniquePath = existing ? `${path}-${seoSlug(Object.values(filters)[0])}` : path;
    const description = kind === 'marcas'
      ? `Explora productos ${name} en Findi: características, formatos y ofertas de ferreterías de Chile cuando estén disponibles.`
      : `Encuentra ${name.toLowerCase()} en Findi. Revisa características, marcas y formatos y compara ofertas de ferreterías de Chile cuando estén disponibles.`;
    result.push({path: uniquePath, name, title: `${name}: productos y precios en Chile | Findi`, description, filters, products:items});
  }
  for (const category of categories) add('categorias', category.nombre, {categoria:category.id}, products.filter(p=>p.categoriaId===category.id));
  for (const family of families) {
    const sub = subcategories.find(s=>s.id===family.subcategoriaId);
    add('familias', family.nombre, {familia:family.id, subcategoria:family.subcategoriaId || '', categoria:sub?.categoriaId || ''}, products.filter(p=>p.familiaId===family.id));
  }
  for (const brand of brands) if (brandIdentity(brand.nombre)) add('marcas',brand.nombre,{marcaId:brand.id,marca:brand.nombre},products.filter(p=>p.marcaId===brand.id || (!p.marcaId && brandIdentity(p.marca)?.id===brand.id)));
  return result;
}
export function productSeoDescription(product: any, familyName = ''): string {
  const source = String(product.descripcionCorta || product.descripcionLarga || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const brand = brandIdentity(product.marca)?.nombre;
  const details = [familyName,brand,product.presentacion,product.unidadVenta].filter(Boolean).join(' · ');
  const text = source || `${product.nombre}${details ? `: ${details}` : ''}. Consulta características y ofertas disponibles de ferreterías de Chile en Findi.`;
  return text.length>160 ? `${text.slice(0,157).trimEnd()}...` : text;
}
