import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { cloudAuth, cloudPool, secretValue, requireApply, projectId } from './lib/sql-cloud.mjs';
import { PostgresDatabase } from '../lib/database/postgres.js';
import { uploadProductImage } from '../lib/services/image-storage.service.js';

async function verifyExternal(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /fallback|placeholder/i.test(parsed.pathname)) throw Error('EXTERNAL_URL_INVALID');
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('EXTERNAL_IMAGE_UNAVAILABLE');
  await response.body?.cancel();
}

async function main() {
  requireApply();
  const argument = process.argv.indexOf('--manifest');
  if (argument < 0 || !process.argv[argument + 1]) throw Error('MANIFEST_REQUIRED');
  const manifestPath = resolve(process.argv[argument + 1]);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.images) || !manifest.images.length) throw Error('MANIFEST_INVALID');
  const auth = await cloudAuth();
  if (manifest.images.some(item => item.file || item.storeInR2 === true)) {
    process.env.FINDI_R2_ACCESS_KEY_ID = await secretValue(auth, 'FINDI_R2_ACCESS_KEY_ID');
    process.env.FINDI_R2_SECRET_ACCESS_KEY = await secretValue(auth, 'FINDI_R2_SECRET_ACCESS_KEY');
  }
  const { pool, close } = await cloudPool(auth, 'findi_runtime', await secretValue(auth, 'FINDI_SQL_PASSWORD'), 2);
  const totals = { generated: 0, storedExternal: 0, external: 0, fallback: 0, preserved: 0 };
  try {
    const db = new PostgresDatabase(pool, true), candidates = [];
    for (const item of manifest.images) {
      const { rows } = await pool.query('SELECT id,name,api_payload FROM findi.products WHERE id=$1 AND deleted_at IS NULL', [item.productId]);
      if (rows.length !== 1 || rows[0].name !== item.name) throw Error('PRODUCT_IDENTITY_CHANGED');
      const current = rows[0].api_payload;
      if (current.imagenPrincipalUrl && !(item.url && current.imagenStorageUrl && !current.imagenExternaUrl)) { totals.preserved++; continue; }
      if (item.file && (item.sourceType !== 'ai_generated' || current.marca !== 'Por especificar')) throw Error('GENERATED_IMAGE_IDENTITY_INVALID');
      candidates.push({ item, current });
    }
    if (candidates.length) {
      await mkdir('tmp/sql-migration', { recursive: true });
      await writeFile(`tmp/sql-migration/product-images-backup-${Date.now()}.json`, JSON.stringify({ projectId, products: candidates }), { mode: 0o600, flag: 'wx' });
    }
    for (const { item, current } of candidates) {
      let fields;
      if (item.file) {
        const data = await readFile(resolve(item.file));
        if (createHash('sha256').update(data).digest('hex') !== item.sha256) throw Error('GENERATED_FILE_CHANGED');
        const image = await uploadProductImage(data, 'image/webp');
        await verifyExternal(image.storageImageUrl); await verifyExternal(image.thumbnailImageUrl);
        fields = {
          imagenPrincipalUrl: image.storageImageUrl, imagenStorageUrl: image.storageImageUrl, imagenStoragePath: image.storageImagePath,
          imagenMiniaturaUrl: image.thumbnailImageUrl, imagenMiniaturaPath: image.thumbnailImagePath, galeriaJson: [image.storageImageUrl],
          origenImagen: 'ai_generated', proveedorImagen: 'OpenAI', referenciaAutorizacion: `Generación propia Findi: sha256:${item.sha256}`,
          terminosFuenteUrl: 'https://openai.com/policies/terms-of-use/', contieneMarcasTerceros: false,
          derechosRevisadosEn: null, derechosRevisadosPor: null, imagenReferencial: true, imagenLote: 'ia-tanda-01'
        };
      } else {
        await verifyExternal(item.url);
        if (!item.sourceUrl || new URL(item.sourceUrl).protocol !== 'https:') throw Error('IMAGE_SOURCE_REQUIRED');
        fields = current.imagenStorageUrl
          ? { imagenExternaUrl: item.url, fuenteImagenUrl: item.sourceUrl }
          : {
            imagenPrincipalUrl: item.url, imagenExternaUrl: item.url, galeriaJson: [item.url],
            origenImagen: 'external_url', proveedorImagen: new URL(item.sourceUrl).hostname, fuenteImagenUrl: item.sourceUrl,
            referenciaAutorizacion: null, derechosRevisadosEn: null, derechosRevisadosPor: null,
            imagenReferencial: item.referential === true, imagenLote: 'urls-tanda-02'
          };
        if (item.storeInR2 === true && !current.imagenStorageUrl) {
          const response = await fetch(item.url, { signal: AbortSignal.timeout(25000) });
          if (!response.ok) throw Error('SOURCE_DOWNLOAD_FAILED');
          const image = await uploadProductImage(Buffer.from(await response.arrayBuffer()), (response.headers.get('content-type') || '').split(';')[0]);
          await verifyExternal(image.storageImageUrl); await verifyExternal(image.thumbnailImageUrl);
          Object.assign(fields, {
            imagenPrincipalUrl: image.storageImageUrl, imagenStorageUrl: image.storageImageUrl, imagenStoragePath: image.storageImagePath,
            imagenMiniaturaUrl: image.thumbnailImageUrl, imagenMiniaturaPath: image.thumbnailImagePath, galeriaJson: [image.storageImageUrl]
          });
        }
      }
      const ref = db.collection('productosMaestro').doc(item.productId);
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref), latest = snapshot.data();
        if (!snapshot.exists || latest.imagenPrincipalUrl !== current.imagenPrincipalUrl || latest.imagenExternaUrl !== current.imagenExternaUrl) throw Error('IMAGE_CHANGED_DURING_IMPORT');
        tx.update(ref, { ...fields, actualizadoEn: new Date().toISOString() });
      });
      const outcome = item.file ? 'generated' : item.storeInR2 === true && !current.imagenStorageUrl ? 'storedExternal' : current.imagenStorageUrl ? 'fallback' : 'external';
      totals[outcome]++; console.log(JSON.stringify({ productId: item.productId, outcome }));
    }
    console.log(JSON.stringify(totals));
  } finally { await close(); }
}
main().catch(error => { console.error('PRODUCT_IMAGE_BATCH_FAILED', error.code || (error.message?.match(/^[A-Z_]+$/) ? error.message : 'ERROR')); process.exitCode = 1; });
