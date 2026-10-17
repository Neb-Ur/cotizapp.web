const DEFAULT_API_BASE_URL = '/api';
// Node SSR cannot resolve a relative browser URL through the development proxy.
const SERVER_API_BASE_URL = 'https://trovio.cl/api';

declare global {
  interface Window {
    __APP_API_BASE_URL__?: string;
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return SERVER_API_BASE_URL;
  }

  const raw = window.__APP_CONFIG__?.apiBaseUrl || window.__APP_API_BASE_URL__;
  if (!raw || !raw.trim()) {
    return DEFAULT_API_BASE_URL;
  }

  return normalizeUrl(raw.trim());
}

export const API_BASE_URL = resolveApiBaseUrl();

// Bypass Hosting's CDN for consented IP statistics; the function resolves the actual connection IP.
export const VISIT_ANALYTICS_URL = 'https://southamerica-west1-cotizapp-d71c8.cloudfunctions.net/api/analytics/visit';
