const DEFAULT_API_BASE_URL = 'http://localhost:5011/api';

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
    return DEFAULT_API_BASE_URL;
  }

  const raw = window.__APP_CONFIG__?.apiBaseUrl || window.__APP_API_BASE_URL__;
  if (!raw || !raw.trim()) {
    return DEFAULT_API_BASE_URL;
  }

  return normalizeUrl(raw.trim());
}

export const API_BASE_URL = resolveApiBaseUrl();
