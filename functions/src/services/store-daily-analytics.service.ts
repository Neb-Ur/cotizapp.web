import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { rows } from '../repositories/firestore.repository.js';
import { getPublicCatalogSnapshot } from '../lib/public-catalog-cache.js';
import { aggregateStoreDailyAnalytics } from '../domain/store-daily-analytics.js';
export async function refreshStoreDailyAnalyticsSnapshot(now = new Date()): Promise<number> {
  const [stores, projects, catalog, events, snapshot] = await Promise.all([
    rows(COLLECTIONS.stores), rows(COLLECTIONS.projects), rows(COLLECTIONS.storeProducts), rows(COLLECTIONS.storeMetrics), getPublicCatalogSnapshot()
  ]);
  const metrics = aggregateStoreDailyAnalytics(stores, projects, snapshot.searchRows, catalog, snapshot.products, events, now);
  const entries = [...metrics];
  for (let offset = 0; offset < entries.length; offset += 400) {
    const batch = db.batch();
    for (const [id, report] of entries.slice(offset, offset + 400)) batch.set(db.collection(COLLECTIONS.storeDailyAnalytics).doc(id), report);
    await batch.commit();
  }
  return entries.length;
}

export async function refreshStoreDailyAnalyticsOncePerDay(now = new Date()): Promise<number | null> {
  const date = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const ref = db.collection(COLLECTIONS.analyticsJobs).doc('store-daily-analytics');
  const claimed = await db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (previous.data()?.['attemptDate'] === date) return false;
    tx.set(ref, {attemptDate: date, startedAt: now.toISOString(), status:'running'}); return true;
  });
  if (!claimed) return null;
  try {
    const stores = await refreshStoreDailyAnalyticsSnapshot(now);
    await ref.update({status:'complete',completedAt:new Date().toISOString(),stores}); return stores;
  } catch (error) {
    await ref.update({status:'failed',failedAt:new Date().toISOString()}); throw error;
  }
}
