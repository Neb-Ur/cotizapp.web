export const STORE_ANALYTICS_INTERVAL_HOURS = 2;
export const STORE_ANALYTICS_TIME_ZONE = 'America/Santiago';
export const STORE_ANALYTICS_CRON = '0 */2 * * *';

/** One claim per two-hour Chilean clock interval, including midnight and DST. */
export function storeAnalyticsPeriod(now: Date): { date: string; key: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_ANALYTICS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  const date = `${value('year')}-${value('month')}-${value('day')}`;
  const hour = Math.floor(Number(value('hour')) / STORE_ANALYTICS_INTERVAL_HOURS) * STORE_ANALYTICS_INTERVAL_HOURS;
  return { date, key: `${date}T${String(hour).padStart(2, '0')}` };
}
