interface RecoveryBrowser {
  location: { origin: string; href: string; replace(url: string): void };
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  navigator: { onLine: boolean };
}
const RETRY_KEY = 'trovio-chunk-recovery';
export function recoverChunkNavigationError(error: unknown, url: string, browser?: RecoveryBrowser, now = Date.now()): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(message)) return false;
  browser = browser || (typeof window !== 'undefined' ? window : undefined);
  if (!browser || !browser.navigator.onLine) return false;
  const target = new URL(url, browser.location.origin);
  if (target.origin !== browser.location.origin) return false;
  if (new URL(browser.location.href).searchParams.get('_actualizar') === '1') return false;
  try {
    const last = Number(browser.sessionStorage.getItem(RETRY_KEY));
    if (last && now - last < 60000) return false;
    browser.sessionStorage.setItem(RETRY_KEY, String(now));
  } catch { /* The URL marker still prevents loops when storage is unavailable. */ }
  target.searchParams.set('_actualizar', '1');
  browser.location.replace(target.pathname + target.search + target.hash);
  return true;
}
