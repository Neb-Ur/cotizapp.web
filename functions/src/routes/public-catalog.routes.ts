import { Router } from 'express';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';

export const publicCatalogRouter = Router();

publicCatalogRouter.get('/catalogo-publico/version', async (_req, res) => {
  const snapshot = await getPublicCatalogSnapshot();
  res.set('Cache-Control', 'public, max-age=10, s-maxage=15, stale-while-revalidate=60');
  return res.json({
    ok: true,
    data: {
      version: snapshot.version,
      updatedAt: snapshot.updatedAt
    }
  });
});

publicCatalogRouter.get('/catalogo-publico', async (req, res) => {
  const snapshot = await getPublicCatalogSnapshot();
  const requestedVersion = String(req.query['v'] || '').trim();

  if (requestedVersion && requestedVersion === snapshot.version) {
    res.set('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
  } else {
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  }

  res.set('ETag', `"catalog-${snapshot.version}"`);
  return res.json({ ok: true, data: snapshot });
});
