import { Router, raw } from 'express';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { IMAGE_CONTENT_TYPES, ImageStorageError, MAX_IMAGE_BYTES, uploadProductImage } from '../services/image-storage.service.js';

export const imagesRouter = Router();
imagesRouter.post('/admin/imagenes/productos', requireAuth, requireRole('admin'), raw({ type: IMAGE_CONTENT_TYPES, limit: MAX_IMAGE_BYTES }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { return ok(res, await uploadProductImage(req.body, (req.get('Content-Type') || '').split(';')[0].trim().toLowerCase()), 201); }
  catch (error) {
    if (error instanceof ImageStorageError) return fail(res, error.code, error.message, error.status);
    throw error;
  }
});
