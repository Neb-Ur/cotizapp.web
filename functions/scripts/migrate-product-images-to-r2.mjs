import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cloudAuth, cloudPool, secretValue, requireApply, projectId } from './lib/sql-cloud.mjs';
import { PostgresDatabase } from '../lib/database/postgres.js';
import { imageStorageConfig, uploadProductImage, MAX_IMAGE_BYTES } from '../lib/services/image-storage.service.js';

const root = new URL('../../', import.meta.url);
async function download(url) {
  if (new URL(url).protocol !== 'https:') throw Error('SOURCE_URL_INVALID');
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw Error('SOURCE_DOWNLOAD_FAILED');
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw Error('SOURCE_IMAGE_TOO_LARGE');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw Error('SOURCE_IMAGE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => undefined); }
  return { body: Buffer.concat(chunks), type: (response.headers.get('content-type') || '').split(';')[0].trim() };
}

async function main() {
  requireApply();
  if (!imageStorageConfig().configured) throw Error('R2_CONFIG_INVALID');
  const manifest = JSON.parse(await readFile(new URL('docs/catalogo/imagenes-externas-tanda-01.json', root), 'utf8'));
  const auth = await cloudAuth();
  process.env.FINDI_R2_ACCESS_KEY_ID = await secretValue(auth, 'FINDI_R2_ACCESS_KEY_ID');
  process.env.FINDI_R2_SECRET_ACCESS_KEY = await secretValue(auth, 'FINDI_R2_SECRET_ACCESS_KEY');
  const { pool, close } = await cloudPool(auth, 'findi_runtime', await secretValue(auth, 'FINDI_SQL_PASSWORD'), 2);
  let migrated = 0, preserved = 0;
  try {
    const db = new PostgresDatabase(pool, true), candidates = [];
    for (const image of manifest.images) {
      const found = await pool.query('SELECT id,api_payload FROM findi.products WHERE name=$1 AND deleted_at IS NULL', [image.name]);
      if (found.rows.length !== 1) throw Error('PRODUCT_MATCH_INVALID');
      const product = found.rows[0];
      if (product.api_payload.imagenStorageUrl) { preserved++; continue; }
      if (product.api_payload.imagenPrincipalUrl !== image.url || (product.api_payload.imagenExternaUrl && product.api_payload.imagenExternaUrl !== image.url)) throw Error('SOURCE_IMAGE_CHANGED');
      candidates.push({ ...product, image });
    }
    if (candidates.length) {
      await mkdir(new URL('tmp/sql-migration/', root), { recursive: true });
      await writeFile(new URL(`tmp/sql-migration/r2-images-backup-${Date.now()}.json`, root), JSON.stringify({ projectId, products: candidates.map(({ id, api_payload }) => ({ id, before: api_payload })) }), { mode: 0o600, flag: 'wx' });
    }
    for (const product of candidates) {
      const source = await download(product.image.url);
      const uploaded = await uploadProductImage(source.body, source.type);
      for (const url of [uploaded.storageImageUrl, uploaded.thumbnailImageUrl]) {
        const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!response.ok || !response.headers.get('content-type')?.includes('image/webp')) throw Error('R2_PUBLIC_READ_FAILED');
        await response.arrayBuffer();
      }
      const ref = db.collection('productosMaestro').doc(product.id);
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref), current = snapshot.data();
        if (!snapshot.exists || current.imagenStorageUrl || current.imagenPrincipalUrl !== product.image.url) throw Error('PRODUCT_IMAGE_CHANGED_DURING_UPLOAD');
        const gallery = Array.isArray(current.galeriaJson) && current.galeriaJson.length ? current.galeriaJson.map(url => url === product.image.url ? uploaded.storageImageUrl : url) : [uploaded.storageImageUrl];
        transaction.update(ref, {
          imagenPrincipalUrl: uploaded.storageImageUrl, imagenStorageUrl: uploaded.storageImageUrl, imagenStoragePath: uploaded.storageImagePath,
          imagenMiniaturaUrl: uploaded.thumbnailImageUrl, imagenMiniaturaPath: uploaded.thumbnailImagePath,
          imagenExternaUrl: product.image.url, galeriaJson: gallery, actualizadoEn: new Date().toISOString()
        });
      });
      migrated++; console.log(JSON.stringify({ migratedProduct: product.id, variants: 2 }));
    }
    console.log(JSON.stringify({ migrated, preserved, objectsAdded: migrated * 2, externalFallbackPreserved: true }));
  } finally { await close(); }
}

main().catch(error => { console.error('R2_IMAGE_MIGRATION_FAILED', error.code || (error.message?.match(/^[A-Z_]+$/) ? error.message : 'ERROR')); process.exitCode = 1; });
