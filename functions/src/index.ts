import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { mvpRouter } from './routes/mvp.routes.js';
import { publicCatalogRouter } from './routes/public-catalog.routes.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

// Supports Firebase Hosting rewrites (/api/**) and the direct function URL.
app.use('/api', publicCatalogRouter);
app.use('/', publicCatalogRouter);
app.use('/api', mvpRouter);
app.use('/', mvpRouter);

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint no encontrado.' }
  });
});

export const api = onRequest(
  {
    region: 'southamerica-west1',
    cors: true,
    minInstances: 1,
    maxInstances: 10
  },
  app
);

export {
  publicCacheOnStoreProductWrite,
  publicCacheOnMasterProductWrite,
  publicCacheOnCategoryWrite,
  publicCacheOnSubcategoryWrite,
  publicCacheOnFamilyWrite,
  publicCacheOnStoreWrite,
  publicCacheOnUserWrite
} from './triggers/public-catalog-cache.triggers.js';
