import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { refreshStoreDailyAnalyticsOncePerDay } from '../services/store-daily-analytics.service.js';
export const refreshStoreDailyAnalytics = onSchedule({schedule: '0 2 * * *', timeZone: 'America/Santiago', region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0}, async () => {
  const stores = await refreshStoreDailyAnalyticsOncePerDay();
  logger.info(stores === null ? 'Daily store analytics already attempted today' : 'Daily store analytics refreshed', {stores});
});
