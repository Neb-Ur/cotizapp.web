import { Router } from 'express';
import { getPublicCatalogMetadata, getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';

export const publicCatalogRouter = Router();

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
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  } else {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  }

  res.set('ETag', `"catalog-${snapshot.version}"`);
  return res.json({ ok: true, data: snapshot });
});
