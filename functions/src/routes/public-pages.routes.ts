import { Router } from 'express';
import { catalogLandings, productSeoDescription, seoProductSlug } from '../domain/catalog-seo.js';
import { brandIdentity } from '../domain/brand-identity.js';
import { getStaticCatalog } from '../lib/product-sheet-cache.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import { readFileSync } from 'node:fs';
import { getProductSheet } from '../lib/product-sheet-cache.js';
export const publicPagesRouter = Router();
const SITE_URL = 'https://cotizapp-d71c8.web.app';
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,120);
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
function page(title: string, description: string, path: string, body: string, schema?: unknown, image?: string, type = 'product'): string {
  let template = readFileSync(new URL('../../assets/index.html', import.meta.url), 'utf8');
  template = template.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<meta[^>]*(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '').replace(/<link[^>]*rel="canonical"[^>]*>/g, '').replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
  const url = `${SITE_URL}${path}`;
  const imageUrl = image && /^https?:\/\//.test(image) ? image : image?.startsWith('/') ? `${SITE_URL}${image}` : `${SITE_URL}/assets/home-hero-construction.webp`;
  const metadata = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${type}"><meta property="og:image" content="${escape(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escape(imageUrl)}">${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>` : '<meta name="robots" content="noindex">'}`;
  return template.replace('</head>', `${metadata}</head>`).replace(/<app-root[^>]*>[\s\S]*?<\/app-root>/, `<app-root ngSkipHydration>${body}</app-root>`);
}
// Keep legacy links and all quotation/selection query parameters working.
publicPagesRouter.get('/producto', async (req, res, next) => {
  try {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const query = new URLSearchParams(req.originalUrl.split('?')[1] || '');
    const name = query.get('product') || '';
    if (!name) return res.redirect(302, '/buscar');
    const product = (await getProductSheet(name.trim().toLowerCase(), ''))?.productoMaestro;
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | Trovio', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar materiales</a></main>'));
    query.delete('product');
    return res.redirect(302, `/productos/${product.seoPath?.split('/').pop() || slug(String(product.nombre))}${query.size ? `?${query}` : ''}`);
  } catch (error) { return next(error); }
});
publicPagesRouter.get('/productos/:slug', async (req, res, next) => {
  try {
    const sheet = await getProductSheet('', String(req.params.slug));
    const product = sheet?.productoMaestro;
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | Trovio', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar materiales</a></main>'));
    const description = productSeoDescription(product, sheet.familyName);
    const landings = catalogLandings(await getStaticCatalog());
    const related = landings.filter(p => p.products.some(item=>item.id===product.id));
    const snapshot = await getPublicCatalogSnapshot();
    const offers = snapshot.searchRows.filter(row => row.productoMaestroId === product.id && Number(row.price)>0);
    const schema = { '@context':'https://schema.org', '@graph':[
      {'@type':'Product', name:product.nombre, description, url:`${SITE_URL}${req.path}`,
        ...(brandIdentity(product.marca) ? {brand:{'@type':'Brand',name:product.marca}} : {}),
        category:[sheet.categoryName,sheet.subcategoryName,sheet.familyName].join(' > '),
        ...(product.imagenPrincipalUrl ? {image:[product.imagenPrincipalUrl]} : {}),
        ...(offers.length ? {offers:{'@type':'AggregateOffer',priceCurrency:'CLP',lowPrice:Math.min(...offers.map(o=>Number(o.price))),highPrice:Math.max(...offers.map(o=>Number(o.price))),offerCount:offers.length,url:`${SITE_URL}${req.path}`}} : {})},
      {'@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Inicio',item:SITE_URL },...related.filter(p=>p.path.startsWith('/familias/')).slice(0,1).map(p=>({'@type':'ListItem',position:2,name:p.name,item:`${SITE_URL}${p.path}`})),{'@type':'ListItem',position:related.some(p=>p.path.startsWith('/familias/'))?3:2,name:product.nombre,item:`${SITE_URL}${req.path}`}]}]};
    const body = `<main><a href="/buscar">Buscar materiales</a><h1>${escape(product.nombre)}</h1><p>${escape(description)}</p><nav aria-label="Categorías del producto">${related.map(p=>`<a href="${escape(p.path)}">${escape(p.name)}</a>`).join(" · ")}</nav><dl>${sheet.atributosProducto.map((attribute: any) => `<dt>${escape(attribute.etiqueta)}</dt><dd>${escape(attribute.valorTexto ?? attribute.valorNumero ?? attribute.valorOpcion ?? attribute.valorBooleano ?? '')}</dd>`).join('')}</dl><p role="status">Cargando precios de las ferreterías…</p><noscript>Activa JavaScript para consultar las ofertas vigentes de las ferreterías.</noscript></main>`;
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    return res.type('html').send(page(`${product.nombre}: precios en ferreterías | Trovio`, description, req.path, body, schema, String(product.imagenPrincipalUrl || '')));
  } catch(error) { return next(error); }
});
publicPagesRouter.get(['/:kind(categorias|familias|marcas)/:slug'], async (req,res,next) => {
  try {
    const catalog = await getStaticCatalog();
    const landings = catalogLandings(catalog);
    const landing = landings.find(p=>p.path===req.path);
    if (!landing) {res.set('X-Robots-Tag','noindex');return res.status(404).type('html').send(page('Sección no encontrada | Trovio','Esta sección no existe.',req.path,'<main><h1>Sección no encontrada</h1><a href="/buscar">Buscar materiales</a></main>'));}
    const related = landings.filter(p=>p.path!==landing.path && p.products.some(item=>landing.products.some(product=>product.id===item.id)));
    const schema = {'@context':'https://schema.org','@graph':[
      {'@type':'CollectionPage',name:landing.name,description:landing.description,url:`${SITE_URL}${landing.path}`,mainEntity:{'@type':'ItemList',numberOfItems:landing.products.length,itemListElement:landing.products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.nombre,url:`${SITE_URL}/productos/${seoProductSlug(p,catalog[0])}`}))}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:SITE_URL},{'@type':'ListItem',position:2,name:landing.name,item:`${SITE_URL}${landing.path}`}]}]};
    const body = `<main><nav><a href="/">Inicio</a> · <a href="/buscar">Productos</a></nav><h1>${escape(landing.name)}</h1><p>${escape(landing.description)}</p><p>${landing.products.length} productos en el catálogo</p><ul>${landing.products.map(p=>`<li><a href="/productos/${seoProductSlug(p,catalog[0])}">${escape(p.nombre)}</a></li>`).join('')}</ul><nav aria-label="Secciones relacionadas">${related.map(p=>`<a href="${escape(p.path)}">${escape(p.name)}</a>`).join(' · ')}</nav></main>`;
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    return res.type('html').send(page(landing.title,landing.description,landing.path,body,schema,undefined,'website'));
  } catch(error) {return next(error);}
});
publicPagesRouter.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.accepts('html') !== 'html') return next();
  res.set('X-Robots-Tag','noindex');
  return res.status(404).type('html').send(page('Página no encontrada | Trovio','Esta página no existe.',req.path,'<main><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>'));
});
