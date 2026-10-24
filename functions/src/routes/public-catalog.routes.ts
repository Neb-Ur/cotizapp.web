import {homeCatalog} from '../domain/home-catalog.js';
import { Router } from 'express';
import { catalogLandings, relatedCatalogLandings, seoSlug, productSeoSlugIndex } from '../domain/catalog-seo.js';
import { createHash } from 'node:crypto';
import { brandIdentity } from '../domain/brand-identity.js';
import { brandUses } from '../domain/brand-use.js';
import { getStaticCatalog, staticCatalogRevision } from '../lib/product-sheet-cache.js';
import { getPublicCatalogMetadata, getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';

export const publicCatalogRouter = Router();

const SITE_URL = 'https://trovio.cl';
const STATIC_SITEMAP_PATHS = [
  '',
  '/buscar',
  '/maestros',
  '/ferreterias',
  '/contacto',
  '/preguntas-frecuentes',
  '/terminos-condiciones',
  '/privacidad',
  '/propiedad-intelectual'
];

function productSlug(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function xmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

publicCatalogRouter.get('/sitemap.xml', async (_req, res) => {
  const catalog = await getStaticCatalog();
  const productSlugs=productSeoSlugIndex(catalog[0]);
  const productPaths = catalog[0].filter(p => p.estado !== 'inactivo' && p.esPrueba !== true)
    .map(p => `/productos/${productSlugs.get(p.id)}`).filter(path => path !== '/productos/');
  const landings = catalogLandings(catalog);
  const paths = [...new Set([...STATIC_SITEMAP_PATHS, ...productPaths, ...landings.filter(p=>p.index).map(p=>p.path)])];
  const urls = paths.map((path) => [
    '  <url>',
    `    <loc>${xmlText(`${SITE_URL}${path}`)}</loc>`,
    '  </url>'
  ].join('\n')).join('\n');

  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate');
  res.type('application/xml');
  return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

publicCatalogRouter.get('/catalogo-publico/version', async (_req, res) => {
  const metadata = await getPublicCatalogMetadata();
  res.set('Cache-Control', 'public, max-age=10, s-maxage=15, stale-while-revalidate=60');
  return res.json({
    ok: true,
    data: metadata
  });
});

// The home page needs four cards, not the entire browser catalog download.
publicCatalogRouter.get('/catalogo-inicio', async (_req,res)=>{
  const snapshot=await getPublicCatalogSnapshot();
  const preview=homeCatalog(snapshot);
  res.set('Cache-Control','no-store');
  return res.json({ok:true,data:preview});
});

publicCatalogRouter.get('/catalogo-publico', async (req, res) => {
  const requestedVersion = String(req.query['v'] || '').trim();
  const snapshot = await getPublicCatalogSnapshot({
    allowStale: !requestedVersion.startsWith('dirty-'),
    expectedVersion: requestedVersion || undefined
  });

  if (requestedVersion && requestedVersion === snapshot.version) {
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30, must-revalidate');
  } else {
    res.set('Cache-Control', 'public, max-age=0, s-maxage=30, must-revalidate');
  }

  res.set('ETag', `"catalog-${snapshot.version}"`);
  return res.json({ ok: true, data: snapshot });
});

// This index contains no prices, stock, contact information or internal fields.
const searchIndexes = new WeakMap<any[][], ReturnType<typeof buildSearchIndex>>();
function buildSearchIndex(catalog:any[][]) {
  const [products, categories, subcategories, families, brands] = catalog;
  const brandNames = new Map(brands.map(item=>[item.id,item.nombre]));
  const slugs=productSeoSlugIndex(products);
  const options = (items: any[]) => items.map(item => ({ id: item.id, name: item.nombre,
    ...(item.categoriaId ? { categoryId: item.categoriaId } : {}),
    ...(item.subcategoriaId ? { subcategoryId: item.subcategoriaId } : {})
  })).sort((a, b) => a.id.localeCompare(b.id));
  const payload = {
    schema: 1, catalogRevision: staticCatalogRevision(),
    products: products.filter(item => item.estado !== 'inactivo').map(item => ({
      id: item.id, name: item.nombre, path:`/productos/${slugs.get(item.id)}`, brandId: item.marcaId || brandIdentity(item.marca)?.id || null,
      brand: brandNames.get(item.marcaId) || item.marca || '', type: item.tipoProducto || '',
      categoryId: item.categoriaId, subcategoryId: item.subcategoriaId, familyId: item.familiaId
    })).sort((a, b) => a.id.localeCompare(b.id)),
    categories: options(categories), subcategories: options(subcategories), families: options(families),
    brands: options(brands.filter(brand=>brandUses(brand.usos).includes('fabricante')))
  };
  const version = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
  return {version,...payload};
}

publicCatalogRouter.get('/catalogo-busqueda', async (req, res) => {
  const catalog=await getStaticCatalog();
  let index=searchIndexes.get(catalog);
  if(!index){index=buildSearchIndex(catalog);searchIndexes.set(catalog,index);}
  const {version}=index;
  res.set('Cache-Control', 'no-store');
  res.set('ETag', `"search-${version}"`);
  return res.json({ ok: true, data: req.query['v'] === version
    ? { version, unchanged: true } : index });
});

publicCatalogRouter.get('/catalogo-seo/:kind/:slug', async (req, res, next) => {
  try {
    const pages = catalogLandings(await getStaticCatalog());
    const landing = pages.find(page => page.path === `/${req.params.kind}/${req.params.slug}`);
    if (!landing) return res.status(404).json({ok:false,error:{code:'NOT_FOUND',message:'Esta sección no existe.'}});
    const related = relatedCatalogLandings(pages,landing.products,landing.path)
      .map(({path,name})=>({path,name}));
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    const {products,...metadata} = landing;
    return res.json({ok:true,data:{...metadata,count:products.length,related}});
  } catch(error) { return next(error); }
});
