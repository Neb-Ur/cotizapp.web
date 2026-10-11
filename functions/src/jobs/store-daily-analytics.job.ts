import { STORE_ANALYTICS_CRON, STORE_ANALYTICS_TIME_ZONE, storeAnalyticsScheduledAt } from '../domain/store-analytics-schedule.js';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { refreshStoreAnalyticsOncePerInterval } from '../services/store-daily-analytics.service.js';
import { activateSqlIfRequested,acquireFirestoreWriteLease } from '../database/cutover.js';
import { sqlPassword } from '../database/pool.js';
export const refreshStoreDailyAnalytics = onSchedule({schedule: STORE_ANALYTICS_CRON, timeZone: STORE_ANALYTICS_TIME_ZONE, region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0, secrets:[sqlPassword]}, async event => {
  await activateSqlIfRequested(); const release=await acquireFirestoreWriteLease();
  try {
  const now = new Date();
  const stores = await refreshStoreAnalyticsOncePerInterval(now, storeAnalyticsScheduledAt(event.scheduleTime, now));
  logger.info(stores === null ? 'Store analytics already attempted for this interval' : 'Store analytics refreshed', {stores});
  } finally { await release(); }
});
