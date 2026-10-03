import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { mvpRouter } from './routes/mvp.routes.js';
import { publicCatalogRouter } from './routes/public-catalog.routes.js';
import { generalRateLimit, sensitiveWriteRateLimit, statusLookupRateLimit } from './lib/rate-limit.js';

const app = express();
app.set('trust proxy', 1);

const configuredOrigins = (process.env['ALLOWED_ORIGINS'] || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  'https://cotizapp-d71c8.web.app',
  'https://cotizapp-d71c8.firebaseapp.com',
  'http://localhost:4200',
  'http://localhost:5010',
  ...configuredOrigins
]);

app.use(cors({
  origin(origin, callback) {
    // Requests without Origin include same-origin rewrites, health checks and
    // server-to-server calls. Browser cross-origin requests require allowlist.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('CORS_ORIGIN_DENIED'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 3600
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(generalRateLimit);
app.use(['/solicitudes-contacto', '/api/solicitudes-contacto', '/ip-reports', '/api/ip-reports', '/price-reports', '/api/price-reports', '/marketing/unsubscribe', '/api/marketing/unsubscribe'], sensitiveWriteRateLimit);
app.use(['/ip-reports/status', '/api/ip-reports/status'], statusLookupRateLimit);

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
    cors: false,
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
