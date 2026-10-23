import { Router } from 'express';
import { catalogLandings, relatedCatalogLandings, seoVehicleApplications, productSeoDescription, productSeoSlugIndex } from '../domain/catalog-seo.js';
import { offerConditionLabel } from '../domain/offer-condition.js';
import { brandIdentity } from '../domain/brand-identity.js';
import { getStaticCatalog } from '../lib/product-sheet-cache.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import { readFileSync } from 'node:fs';
import { getProductSheet } from '../lib/product-sheet-cache.js';
export const publicPagesRouter = Router();
const SITE_URL = 'https://trovio.cl';
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,120);
const schemaCondition = (condition:unknown) => ({nuevo:'https://schema.org/NewCondition',usado:'https://schema.org/UsedCondition',reacondicionado:'https://schema.org/RefurbishedCondition',para_reparar:'https://schema.org/DamagedCondition'} as Record<string,string>)[String(condition)];
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
function page(title: string, description: string, path: string, body: string, schema?: unknown, image?: string, type = 'product'): string {
  let template = readFileSync(new URL('../../assets/index.html', import.meta.url), 'utf8');
  template = template.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<meta[^>]*(?:name="description"|name="robots"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '').replace(/<link[^>]*rel="canonical"[^>]*>/g, '').replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
  const url = `${SITE_URL}${path}`;
  const imageUrl = image && /^https?:\/\//.test(image) ? image : image?.startsWith('/') ? `${SITE_URL}${image}` : `${SITE_URL}/assets/home-hero-mixto-v1.webp`;
  const metadata = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${type}"><meta property="og:image" content="${escape(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escape(imageUrl)}">${schema ? `<script id="cotizapp-page-structured-data" type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>` : '<meta name="robots" content="noindex">'}`;
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
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | Trovio', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar productos</a></main>'));
    query.delete('product');
    return res.redirect(302, `/productos/${product.seoPath?.split('/').pop() || slug(String(product.nombre))}${query.size ? `?${query}` : ''}`);
  } catch (error) { return next(error); }
});
publicPagesRouter.get('/productos/:slug', async (req, res, next) => {
  try {
    const sheet = await getProductSheet('', String(req.params.slug));
    const product = sheet?.productoMaestro;
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | Trovio', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar productos</a></main>'));
    if (product.esPrueba === true) res.set('X-Robots-Tag', 'noindex, follow');
    const description = productSeoDescription(product, sheet.familyName);
    const landings = catalogLandings(await getStaticCatalog());
    const related = relatedCatalogLandings(landings,[product]);
    const snapshot = await getPublicCatalogSnapshot();
    const applications = seoVehicleApplications(product);
    const offers = snapshot.searchRows.filter(row => !product.esPrueba && row.productoMaestroId === product.id && !row.storePilot && !row.offerPilot && Number(row.price)>0 && Number(row.stock)>0);
    const schema = { '@context':'https://schema.org', '@graph':[
      {'@type':'Product', name:product.nombre, description, url:`${SITE_URL}${req.path}`,
        ...(brandIdentity(product.marca) ? {brand:{'@type':'Brand',name:product.marca}} : {}),
        category:[sheet.categoryName,sheet.subcategoryName,sheet.familyName].join(' > '),
        ...(product.imagenPrincipalUrl ? {image:[product.imagenPrincipalUrl]} : {}),
        ...(applications.length ? {additionalProperty:applications.map(a=>({'@type':'PropertyValue',name:'Compatibilidad registrada',value:`${a.marcaNombre} ${a.modeloNombre}${a.anioDesde !== null ? ` ${a.anioDesde}–${a.anioHasta}` : ' · Año sin especificar'}`}))} : {}),
        ...(!product.esPrueba && offers.length ? {offers:{'@type':'AggregateOffer',priceCurrency:'CLP',lowPrice:Math.min(...offers.map(o=>Number(o.price))),highPrice:Math.max(...offers.map(o=>Number(o.price))),offerCount:offers.length,url:`${SITE_URL}${req.path}`,offers:offers.map(o=>({'@type':'Offer',priceCurrency:'CLP',price:Number(o.price),availability:'https://schema.org/InStock',url:`${SITE_URL}${req.path}`,seller:{'@type':'Organization',name:o.storeName,url:`${SITE_URL}/ferreterias/${encodeURIComponent(o.storeId)}`},...(schemaCondition(o.condition) ? {itemCondition:schemaCondition(o.condition)} : {})}))}} : {})},
      {'@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Inicio',item:SITE_URL },...related.filter(p=>p.path.startsWith('/familias/')).slice(0,1).map(p=>({'@type':'ListItem',position:2,name:p.name,item:`${SITE_URL}${p.path}`})),{'@type':'ListItem',position:related.some(p=>p.path.startsWith('/familias/'))?3:2,name:product.nombre,item:`${SITE_URL}${req.path}`}]}]};
    const compatibility = applications.length ? `<section aria-label="Compatibilidad del producto"><h2>Compatibilidad registrada</h2><ul>${applications.map(a=>`<li>${escape(a.marcaNombre)} ${escape(a.modeloNombre)} · ${a.anioDesde !== null ? `${a.anioDesde}–${a.anioHasta}` : 'Año sin especificar'}</li>`).join('')}</ul><p>Confirma motor, versión, código de pieza y ajuste con el vendedor antes de comprar.</p></section>` : '';
    const prices = offers.length ? `<section><h2>Precios por local</h2><p>Precios en pesos chilenos con IVA. Disponibilidad y condiciones informadas por cada local; confirma antes de comprar.</p><ul>${offers.map(o=>`<li><a href="/ferreterias/${encodeURIComponent(o.storeId)}">${escape(o.storeName)}</a>${o.storeCommune ? ` · ${escape(o.storeCommune)}` : ''}: $${Number(o.price).toLocaleString('es-CL')} · Stock: ${Number(o.stock)} · Estado: ${offerConditionLabel(o.condition)}${o.offerConditions ? `<p>${escape(o.offerConditions)}</p>` : ''}</li>`).join('')}</ul></section>` : '<p role="status">Cargando precios de los locales…</p>';
    const body = `<main><a href="/buscar">Buscar productos</a><h1>${escape(product.nombre)}</h1><p>${escape(description)}</p>${product.imagenPrincipalUrl ? `<img src="${escape(product.imagenPrincipalUrl)}" alt="${escape(product.nombre)}" width="720" height="540">` : ''}${product.imagenReferencial || product.origenImagen === 'ai_generated' ? '<p>Imagen referencial. Verifica las características y fotografías del local antes de comprar.</p>' : ''}<nav aria-label="Categorías del producto">${related.map(p=>`<a href="${escape(p.path)}">${escape(p.name)}</a>`).join(' · ')}</nav>${product.descripcionLarga ? `<p>${escape(String(product.descripcionLarga).replace(/<[^>]*>/g,' '))}</p>` : ''}<dl>${sheet.atributosProducto.map((attribute:any)=>`<dt>${escape(attribute.etiqueta)}</dt><dd>${escape(attribute.valorTexto ?? attribute.valorNumero ?? attribute.valorOpcion ?? attribute.valorBooleano ?? '')}</dd>`).join('')}</dl>${compatibility}${prices}<noscript>Activa JavaScript para comparar, filtrar y agregar productos a tu cotización.</noscript></main>`;
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    return res.type('html').send(page(`${product.nombre}: precios en locales | Trovio`, description, req.path, body, schema, String(product.imagenPrincipalUrl || '')));
  } catch(error) { return next(error); }
});
publicPagesRouter.get(['/repuestos','/:kind(categorias|familias|marcas|marcas-vehiculos|vehiculos)/:slug'], async (req,res,next) => {
  try {
    const catalog = await getStaticCatalog();
    const landings = catalogLandings(catalog);
    const productSlugs=productSeoSlugIndex(catalog[0]);
    const legacyAuto = landings.find(p=>p.path===req.path && p.filters.categoria==='cat-repuestos-automotrices' && p.path.startsWith('/categorias/'));
    if (legacyAuto && landings.some(p=>p.path==='/repuestos')) {
      const query=new URLSearchParams(req.originalUrl?.split('?')[1] || '');
      return res.redirect(301,`/repuestos${query.size ? `?${query}` : ''}`);
    }
    const landing = landings.find(p=>p.path===req.path);
    if (!landing) {res.set('X-Robots-Tag','noindex');return res.status(404).type('html').send(page('Sección no encontrada | Trovio','Esta sección no existe.',req.path,'<main><h1>Sección no encontrada</h1><a href="/buscar">Buscar productos</a></main>'));}
    if (!landing.index) res.set('X-Robots-Tag', 'noindex, follow');
    const related = relatedCatalogLandings(landings,landing.products,landing.path);
    const schema = {'@context':'https://schema.org','@graph':[
      {'@type':'CollectionPage',name:landing.name,description:landing.description,url:`${SITE_URL}${landing.path}`,mainEntity:{'@type':'ItemList',numberOfItems:landing.products.length,itemListElement:landing.products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.nombre,url:`${SITE_URL}/productos/${productSlugs.get(p.id)}`}))}},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:SITE_URL},{'@type':'ListItem',position:2,name:landing.name,item:`${SITE_URL}${landing.path}`}]}]};
    const body = `<main><nav><a href="/">Inicio</a> · <a href="/buscar">Productos</a></nav><h1>${escape(landing.name)}</h1><p>${escape(landing.description)}</p>${!landing.index ? '<p>Catálogo de referencia: productos de prueba. Confirma disponibilidad y compatibilidad real con el local.</p>' : ''}<p>${landing.products.length} productos en el catálogo</p><ul>${landing.products.map(p=>`<li><a href="/productos/${productSlugs.get(p.id)}">${escape(p.nombre)}</a></li>`).join('')}</ul><nav aria-label="Secciones relacionadas">${related.map(p=>`<a href="${escape(p.path)}">${escape(p.name)}</a>`).join(' · ')}</nav></main>`;
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    return res.type('html').send(page(landing.title,landing.description,landing.path,body,schema,undefined,'website'));
  } catch(error) {return next(error);}
});
publicPagesRouter.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.accepts('html') !== 'html') return next();
  res.set('X-Robots-Tag','noindex');
  return res.status(404).type('html').send(page('Página no encontrada | Trovio','Esta página no existe.',req.path,'<main><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>'));
});
