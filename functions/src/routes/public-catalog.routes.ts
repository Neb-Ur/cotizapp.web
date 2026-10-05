import { Router } from 'express';
import { getPublicCatalogMetadata, getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';

export const publicCatalogRouter = Router();

const SITE_URL = 'https://cotizapp-d71c8.web.app';
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
  const snapshot = await getPublicCatalogSnapshot();
  const lastModified = snapshot.updatedAt.slice(0, 10);
  const productPaths = Array.from(new Set(
    snapshot.searchRows
      .map((row) => productSlug(row.productName))
      .filter(Boolean)
      .map((slug) => `/productos/${slug}`)
  ));
  const paths = [...STATIC_SITEMAP_PATHS, ...productPaths];
  const urls = paths.map((path) => [
    '  <url>',
    `    <loc>${xmlText(`${SITE_URL}${path}`)}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    '  </url>'
  ].join('\n')).join('\n');

  res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
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
