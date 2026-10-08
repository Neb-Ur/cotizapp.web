import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { refreshStoreDailyAnalyticsOncePerDay } from '../services/store-daily-analytics.service.js';
import { activateSqlIfRequested,acquireFirestoreWriteLease } from '../database/cutover.js';
import { sqlPassword } from '../database/pool.js';
export const refreshStoreDailyAnalytics = onSchedule({schedule: '0 2 * * *', timeZone: 'America/Santiago', region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0, secrets:[sqlPassword]}, async () => {
  await activateSqlIfRequested(); const release=await acquireFirestoreWriteLease();
  try {
  const stores = await refreshStoreDailyAnalyticsOncePerDay();
  logger.info(stores === null ? 'Daily store analytics already attempted today' : 'Daily store analytics refreshed', {stores});
  } finally { await release(); }
});
