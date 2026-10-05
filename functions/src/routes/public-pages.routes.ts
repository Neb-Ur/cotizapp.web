import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
export const publicPagesRouter = Router();
const SITE_URL = 'https://cotizapp-d71c8.web.app';
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,120);
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
function page(title: string, description: string, path: string, body: string, schema?: unknown, image?: string): string {
  let template = readFileSync(new URL('../../assets/index.html', import.meta.url), 'utf8');
  template = template.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<meta[^>]*(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '').replace(/<link[^>]*rel="canonical"[^>]*>/g, '').replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
  const url = `${SITE_URL}${path}`;
  const imageUrl = image && /^https?:\/\//.test(image) ? image : image?.startsWith('/') ? `${SITE_URL}${image}` : `${SITE_URL}/assets/home-hero-construction.webp`;
  const metadata = `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="product"><meta property="og:image" content="${escape(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escape(imageUrl)}">${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>` : '<meta name="robots" content="noindex">'}`;
  return template.replace('</head>', `${metadata}</head>`).replace(/<app-root[^>]*>[\s\S]*?<\/app-root>/, `<app-root ngSkipHydration>${body}</app-root>`);
}
// Keep legacy links and all quotation/selection query parameters working.
publicPagesRouter.get('/producto', async (req, res, next) => {
  try {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const query = new URLSearchParams(req.originalUrl.split('?')[1] || '');
    const name = query.get('product') || '';
    if (!name) return res.redirect(302, '/buscar');
    const snapshot = await getPublicCatalogSnapshot();
    const product = snapshot.products.find(item => String(item.nombre).trim().toLowerCase() === name.trim().toLowerCase());
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | CotizApp', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar materiales</a></main>'));
    query.delete('product');
    return res.redirect(302, `/productos/${slug(String(product.nombre))}${query.size ? `?${query}` : ''}`);
  } catch (error) { return next(error); }
});
publicPagesRouter.get('/productos/:slug', async (req, res, next) => {
  try {
    const snapshot = await getPublicCatalogSnapshot();
    const product = snapshot.products.find(item => slug(String(item.nombre)) === req.params.slug);
    if (!product) return res.status(404).type('html').send(page('Producto no encontrado | CotizApp', 'Este producto no existe.', req.path, '<main><h1>Producto no encontrado</h1><a href="/buscar">Buscar materiales</a></main>'));
    const offers = snapshot.searchRows.filter(item => item.productoMaestroId === product.id && item.price > 0);
    const description = `Compara ${product.nombre} en ${offers.length} ferreterías. Precios finales con IVA incluido, informados por cada ferretería.`;
    const schema = { '@context':'https://schema.org', '@type':'Product', name:product.nombre, description, ...(offers.length ? { offers: { '@type':'AggregateOffer', priceCurrency:'CLP', lowPrice:Math.min(...offers.map(o=>o.price)), highPrice:Math.max(...offers.map(o=>o.price)), offerCount:offers.length } } : {}) };
    const body = `<main><a href="/buscar">Buscar materiales</a><h1>${escape(product.nombre)}</h1><p>${escape(product.descripcionCorta)}</p><p>${escape(description)}</p>${offers.length ? `<table><thead><tr><th>Ferretería</th><th>Precio final (IVA incluido)</th><th>Stock</th></tr></thead><tbody>${offers.map(o=>`<tr><td>${escape(o.storeName)}</td><td>${escape(o.price)} CLP</td><td>${escape(o.stock)}</td></tr>`).join('')}</tbody></table>` : '<p role="alert" style="color:#991b1b;background:#fef2f2;border:1px solid #b91c1c;padding:1rem;border-radius:8px">No hay ferreterías con este producto.</p>'}<p>Stock y precio sujetos a confirmación directa con la ferretería. Despacho no incluido.</p></main>`;
    res.set('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
    return res.type('html').send(page(`${product.nombre}: precios en ferreterías | CotizApp`, description, req.path, body, schema, String(product.imagenPrincipalUrl || '')));
  } catch(error) { return next(error); }
});
publicPagesRouter.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.accepts('html') !== 'html') return next();
  res.set('X-Robots-Tag','noindex');
  return res.status(404).type('html').send(page('Página no encontrada | CotizApp','Esta página no existe.',req.path,'<main><h1>Página no encontrada</h1><a href="/">Volver al inicio</a></main>'));
});
