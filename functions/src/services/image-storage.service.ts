import { randomUUID } from 'node:crypto';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export class ImageStorageError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

export function imageStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env['IMAGE_STORAGE_PROVIDER'] === 'r2';
  const accountId = env['R2_ACCOUNT_ID']?.trim() || '';
  const bucket = env['R2_BUCKET']?.trim() || '';
  const publicBaseUrl = (env['R2_PUBLIC_BASE_URL'] || '').trim().replace(/\/+$/, '');
  let validPublicUrl = false;
  try { const url = new URL(publicBaseUrl); validPublicUrl = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'; } catch { /* Not configured yet. */ }
  const configured = enabled && /^[a-f0-9]{32}$/i.test(accountId) && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && validPublicUrl;
  return { enabled, configured, accountId, bucket, publicBaseUrl };
}

export function imageStorageStatus() {
  const { configured } = imageStorageConfig();
  return { provider: 'r2', enabled: configured, maxBytes: MAX_IMAGE_BYTES, contentTypes: IMAGE_CONTENT_TYPES };
}

export async function prepareProductImage(body: Buffer, contentType: string) {
  if (!IMAGE_CONTENT_TYPES.includes(contentType)) throw new ImageStorageError('IMAGE_TYPE_INVALID', 'Usa una imagen JPG, PNG, WebP o AVIF.');
  if (!Buffer.isBuffer(body) || !body.length || body.length > MAX_IMAGE_BYTES) throw new ImageStorageError('IMAGE_SIZE_INVALID', 'La imagen debe pesar entre 1 byte y 8 MB.');
  const { default: sharp } = await import('sharp');
  try {
    const input = sharp(body, { limitInputPixels: 16_000_000, animated: false, failOn: 'warning' });
    const metadata = await input.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format) || !metadata.width || !metadata.height || (metadata.pages || 1) > 1)
      throw new Error('Unsupported image');
    const main = await input.clone().rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumbnail = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return { main: main.data, thumbnail, width: main.info.width, height: main.info.height };
  } catch { throw new ImageStorageError('IMAGE_CONTENT_INVALID', 'El archivo no contiene una imagen válida o supera las dimensiones permitidas.'); }
}

// This runs only for admin uploads. Product views use the public CDN URL directly.
export async function uploadProductImage(body: Buffer, contentType: string) {
  const config = imageStorageConfig();
  if (!config.configured) throw new ImageStorageError('IMAGE_STORAGE_NOT_CONFIGURED', 'La carga de imágenes aún no está configurada.', 503);
  const images = await prepareProductImage(body, contentType);
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  let client;
  try {
    const accessKeyId = process.env['FINDI_R2_ACCESS_KEY_ID'], secretAccessKey = process.env['FINDI_R2_SECRET_ACCESS_KEY'];
    if (!accessKeyId || !secretAccessKey) throw new Error('Missing credentials');
    client = new S3Client({ region: 'auto', endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 });
  } catch { throw new ImageStorageError('IMAGE_STORAGE_NOT_CONFIGURED', 'La carga de imágenes aún no está configurada.', 503); }
  const prefix = `productos/${randomUUID()}`;
  const keys = [`${prefix}/detalle.webp`, `${prefix}/miniatura.webp`];
  try {
    const results = await Promise.allSettled(keys.map((Key, index) => client.send(new PutObjectCommand({ Bucket: config.bucket, Key, Body: index === 0 ? images.main : images.thumbnail, ContentType: 'image/webp', CacheControl: IMAGE_CACHE_CONTROL }))));
    if (results.some(result => result.status === 'rejected')) {
      await Promise.allSettled(keys.map(Key => client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }))));
      throw new ImageStorageError('IMAGE_UPLOAD_FAILED', 'No se pudo subir la imagen. Intenta nuevamente.', 502);
    }
    return { storageImageUrl: `${config.publicBaseUrl}/${keys[0]}`, storageImagePath: keys[0], thumbnailImageUrl: `${config.publicBaseUrl}/${keys[1]}`, thumbnailImagePath: keys[1], width: images.width, height: images.height };
  } finally { client.destroy(); }
}
