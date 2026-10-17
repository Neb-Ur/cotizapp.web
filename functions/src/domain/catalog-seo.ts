import { createHash } from 'node:crypto';
import { normalizeVehicleApplications } from './vehicle-application.js';
import { brandIdentity } from './brand-identity.js';
const AUTOMOTIVE_CATEGORY_ID = 'cat-repuestos-automotrices';
export const SITE_URL = 'https://trovio.cl';
export const seoSlug = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
export function seoProductSlug(product:any, products:any[]):string {
  const slug=seoSlug(product.nombre);
  const matches=products.filter(p=>p.estado!=='inactivo' && seoSlug(p.nombre)===slug).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return matches.length>1 && matches[0].id!==product.id ? `${slug.slice(0,109)}-${createHash('sha256').update(String(product.id)).digest('hex').slice(0,8)}` : slug;
}
// Batch normalization avoids scanning the whole catalog once for every index row.
export function productSeoSlugIndex(products:any[]):Map<string,string> {
  const groups=new Map<string,any[]>();
  for(const product of products){if(product.estado==='inactivo')continue;const slug=seoSlug(product.nombre);const group=groups.get(slug)||[];group.push(product);groups.set(slug,group);}
  const result=new Map<string,string>();
  for(const [slug,group]of groups){group.sort((a,b)=>String(a.id).localeCompare(String(b.id)));group.forEach((product,i)=>result.set(product.id,i?`${slug.slice(0,109)}-${createHash('sha256').update(String(product.id)).digest('hex').slice(0,8)}`:slug));}
  return result;
}
export interface CatalogLanding {
  path: string; name: string; title: string; description: string;
  filters: Record<string, string>; products: any[]; index: boolean;
}
export function catalogLandings([allProducts, categories, subcategories, families, brands]: any[][]): CatalogLanding[] {
  const products = allProducts.filter(p => p.estado !== 'inactivo');
  const result: CatalogLanding[] = [];
  function add(kind: string, name: string, filters: Record<string,string>, items: any[]) {
    if (!items.length || !seoSlug(name)) return;
    if (items.some(p=>p.esPrueba !== true)) items=items.filter(p=>p.esPrueba !== true);
    const path = `/${kind}/${seoSlug(name)}`;
    // Distinct pages with the same human name must not silently share a canonical URL.
    const existing = result.find(p => p.path === path);
    const uniquePath = existing ? `${path}-${seoSlug(filters.vehiculoModeloId || filters.vehiculoMarcaId || Object.values(filters)[0])}` : path;
    const description = kind === 'marcas'
      ? `Explora productos ${name} en Trovio: características, formatos y ofertas de locales de Chile cuando estén disponibles.`
      : `Encuentra ${name.toLowerCase()} en Trovio. Revisa características, marcas y formatos y compara ofertas de locales de Chile cuando estén disponibles.`;
    result.push({path: uniquePath, name, title: `${name}: productos y precios en Chile | Trovio`, description, filters, products:items, index:items.some(p=>p.esPrueba !== true)});
  }
  for (const category of categories) add('categorias', category.nombre, {categoria:category.id}, products.filter(p=>p.categoriaId===category.id));
  for (const family of families) {
    const sub = subcategories.find(s=>s.id===family.subcategoriaId);
    add('familias', family.nombre, {familia:family.id, subcategoria:family.subcategoriaId || '', categoria:sub?.categoriaId || ''}, products.filter(p=>p.familiaId===family.id));
  }
  for (const brand of brands) if (brandIdentity(brand.nombre)) add('marcas',brand.nombre,{marcaId:brand.id,marca:brand.nombre},products.filter(p=>p.marcaId===brand.id || (!p.marcaId && brandIdentity(p.marca)?.id===brand.id)));
  for (const landing of result.filter(p=>p.path.startsWith('/familias/') && p.filters.categoria===AUTOMOTIVE_CATEGORY_ID)) {
    landing.title=`${landing.name}: repuestos de autos en Chile | Trovio`;
    landing.description=`Encuentra ${landing.name.toLowerCase()} para autos en Trovio. Revisa características, compatibilidad registrada y ofertas disponibles de locales en Chile.`;
  }
  const automotive = products.filter(p => p.categoriaId === AUTOMOTIVE_CATEGORY_ID && p.esPrueba !== true);
  const automotiveReferences = products.filter(p=>p.categoriaId===AUTOMOTIVE_CATEGORY_ID);
  result.push({path:'/repuestos',name:'Repuestos de autos en Chile',title:'Repuestos de autos en Chile: busca y compara | Trovio',
    description:'Encuentra repuestos de autos por marca, modelo y tipo de pieza. Revisa la compatibilidad registrada y compara las ofertas disponibles de locales en Chile.',
    filters:{rubro:'repuestos',categoria:AUTOMOTIVE_CATEGORY_ID},products:automotive.length ? automotive : automotiveReferences,index:automotive.length>0});
  // Vehicle origin is never used to infer fitment. Only explicit, non-simulated master applications qualify.
  const vehicleBrands = new Map<string,{name:string;products:Map<string,any>}>();
  const models = new Map<string,{name:string;brandId:string;modelId:string;products:Map<string,any>}>();
  for (const product of automotive) for (const application of seoVehicleApplications(product)) {
    const brand = vehicleBrands.get(application.marcaId) || {name:application.marcaNombre!,products:new Map<string,any>()};
    brand.products.set(product.id,product);vehicleBrands.set(application.marcaId,brand);
    const key = JSON.stringify([application.marcaId,application.modeloId]);
    const model = models.get(key) || {name:`${application.marcaNombre} ${application.modeloNombre}`,brandId:application.marcaId,modelId:application.modeloId,products:new Map<string,any>()};
    model.products.set(product.id,product);models.set(key,model);
  }
  for (const [id,brand] of [...vehicleBrands].sort(([a],[b])=>a.localeCompare(b))) add('marcas-vehiculos',brand.name,{rubro:'repuestos',categoria:AUTOMOTIVE_CATEGORY_ID,vehiculoMarcaId:id},[...brand.products.values()]);
  for (const [,model] of [...models].sort(([a],[b])=>a.localeCompare(b))) add('vehiculos',model.name,{rubro:'repuestos',categoria:AUTOMOTIVE_CATEGORY_ID,vehiculoMarcaId:model.brandId,vehiculoModeloId:model.modelId},[...model.products.values()]);
  for (const landing of result.filter(p=>p.path.startsWith('/vehiculos/') || p.path.startsWith('/marcas-vehiculos/'))) {
    landing.title=`Repuestos ${landing.name} en Chile | Trovio`;
    landing.description=`Explora repuestos con compatibilidad registrada para ${landing.name}. Revisa años, características y ofertas disponibles; confirma la variante con el vendedor.`;
    landing.name=`Repuestos ${landing.name}`;
  }
  return result;
}
export function seoVehicleApplications(product:any) {
  if (product.esPrueba === true || product.compatibilidadReferencial === true) return [];
  try {return normalizeVehicleApplications(product.compatibilidadVehiculos || []).filter(a=>seoSlug(a.marcaNombre) && seoSlug(a.modeloNombre));}
  catch {return [];}
}
export function relatedCatalogLandings(pages:CatalogLanding[], products:any[], excludePath=''):CatalogLanding[] {
  const ids=new Set(products.map(p=>p.id));
  const automotiveEntry=pages.some(page=>page.path==='/repuestos');
  return pages.filter(p=>p.index && !(p.path.startsWith('/categorias/') && p.filters.categoria===AUTOMOTIVE_CATEGORY_ID && automotiveEntry) && p.path!==excludePath && p.products.some(item=>ids.has(item.id)))
    .sort((a,b)=>a.path.localeCompare(b.path,'es'));
}
export function productSeoDescription(product: any, familyName = ''): string {
  const source = String(product.descripcionCorta || product.descripcionLarga || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const brand = brandIdentity(product.marca)?.nombre;
  const details = [familyName,brand,product.presentacion,product.unidadVenta].filter(Boolean).join(' · ');
  const text = source || `${product.nombre}${details ? `: ${details}` : ''}. Consulta características y ofertas disponibles de locales de Chile en Trovio.`;
  return text.length>160 ? `${text.slice(0,157).trimEnd()}...` : text;
}
