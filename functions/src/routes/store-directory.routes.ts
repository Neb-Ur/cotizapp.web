import { Router } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { row, rows } from '../repositories/firestore.repository.js';
import { directoryStores, directoryStore, locationKey, ratingSummary, storeReviews } from '../services/store-directory.service.js';

export const storeDirectoryRouter = Router();
const reviewId = (storeId: string, userId: string) => createHash('sha256').update(JSON.stringify([storeId, userId])).digest('hex');
const pagination = (query: Record<string, any>, defaultSize = 12) => {
  const page = Number(query['page'] ?? 1), size = Number(query['size'] ?? defaultSize);
  return Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(size) && size > 0 && size <= 50 ? { page, size } : null;
};
const publicReview = (review: any) => ({ id: review.id, authorName: review.authorName, rating: review.rating, comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt });

storeDirectoryRouter.get('/directorio-ferreterias', async (req, res) => {
  const paging = pagination(req.query);
  if (!paging) return fail(res, 'DIRECTORY_INVALID_PAGE', 'La página no es válida.', 400);
  const stores = await directoryStores();
  const region = locationKey(String(req.query['region'] || '')), commune = locationKey(String(req.query['comuna'] || ''));
  const query = locationKey(String(req.query['q'] || ''));
  const filtered = stores.filter(store => (!region || locationKey(store.region) === region)
    && (!commune || locationKey(store.commune) === commune) && (!query || locationKey(store.name).includes(query)));
  const reviews = await rows(COLLECTIONS.storeReviews);
  const byStore = new Map<string, any[]>();
  for (const review of reviews) {
    if (!byStore.has(review.storeId)) byStore.set(review.storeId, []);
    byStore.get(review.storeId)!.push(review);
  }
  const total = filtered.length, totalPages = Math.max(1, Math.ceil(total / paging.size)), page = Math.min(paging.page, totalPages);
  res.set('Cache-Control', 'no-store');
  return ok(res, { items: filtered.slice((page - 1) * paging.size, page * paging.size).map(store => ({ ...store, ...ratingSummary(byStore.get(store.id) || []) })),
    total, page, size: paging.size, totalPages,
    storeOptions: stores.map(store => ({id:store.id, name:store.name})),
    regions: [...new Set(stores.map(store => store.region).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')),
    communes: [...new Set(stores.filter(store => !region || locationKey(store.region) === region).map(store => store.commune).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')) });
});

storeDirectoryRouter.get('/directorio-ferreterias/:storeId', async (req, res) => {
  const paging = pagination(req.query, 10);
  if (!paging) return fail(res, 'DIRECTORY_INVALID_PAGE', 'La página no es válida.', 400);
  const store = await directoryStore(req.params.storeId);
  if (!store) return fail(res, 'STORE_NOT_FOUND', 'Esta ferretería no está disponible.', 404);
  const reviews = (await storeReviews(store.id)).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.id.localeCompare(b.id));
  const total = reviews.length, totalPages = Math.max(1, Math.ceil(total / paging.size)), page = Math.min(paging.page, totalPages);
  res.set('Cache-Control', 'no-store');
  return ok(res, { store: { ...store, ...ratingSummary(reviews) }, reviews: reviews.slice((page - 1) * paging.size, page * paging.size).map(publicReview), page, total, totalPages });
});

storeDirectoryRouter.get('/directorio-ferreterias/:storeId/mi-resena', requireAuth, requireRole('maestro'), async (req, res) => {
  if (!await directoryStore(req.params.storeId)) return fail(res, 'STORE_NOT_FOUND', 'Esta ferretería no está disponible.', 404);
  const review = await row(COLLECTIONS.storeReviews, reviewId(req.params.storeId, req.authUserId!));
  res.set('Cache-Control', 'private, no-store');
  return ok(res, review ? publicReview(review) : null);
});

storeDirectoryRouter.put('/directorio-ferreterias/:storeId/mi-resena', requireAuth, requireRole('maestro'), async (req, res) => {
  const rating = req.body?.rating, comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 5 || comment.length > 1500) {
    return fail(res, 'REVIEW_INVALID', 'Elige entre 1 y 5 estrellas y escribe una reseña de 5 a 1500 caracteres.', 400);
  }
  if (!await directoryStore(req.params.storeId)) return fail(res, 'STORE_NOT_FOUND', 'Esta ferretería no está disponible.', 404);
  const profile = await row(COLLECTIONS.users, req.authUserId!);
  const id = reviewId(req.params.storeId, req.authUserId!);
  const ref = db.collection(COLLECTIONS.storeReviews).doc(id);
  const saved = await db.runTransaction(async tx => {
    const previous = await tx.get(ref), now = new Date().toISOString();
    const review = { storeId: req.params.storeId, userId: req.authUserId!, authorName: String(profile?.nombre || 'Maestro').trim().split(/\s+/)[0].slice(0, 60),
      rating, comment, createdAt: previous.data()?.['createdAt'] || now, updatedAt: now };
    tx.set(ref, review);
    return { id, ...review };
  });
  res.set('Cache-Control', 'private, no-store');
  return ok(res, publicReview(saved));
});

storeDirectoryRouter.delete('/directorio-ferreterias/:storeId/mi-resena', requireAuth, requireRole('maestro'), async (req, res) => {
  await db.collection(COLLECTIONS.storeReviews).doc(reviewId(req.params.storeId, req.authUserId!)).delete();
  return ok(res, { deleted: true });
});
