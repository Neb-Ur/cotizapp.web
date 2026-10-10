import { SessionUser } from '../models/app.models';

const APP_ORIGIN = 'https://cotizapp.local';

export function sanitizeReturnUrl(value: string | null | undefined): string | null {
  if (!value?.startsWith('/')) return null;

  try {
    const parsed = new URL(value, APP_ORIGIN);
    if (parsed.origin !== APP_ORIGIN) return null;
    if (parsed.pathname === '/login' || parsed.pathname === '/registro') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostAuthUrl(
  user: SessionUser,
  requestedReturnUrl: string | null | undefined,
  dashboardUrl: string
): string {
  if (user.role === 'ferreteria') return dashboardUrl;
  const returnUrl = sanitizeReturnUrl(requestedReturnUrl);
  if (user.legalAcceptanceRequired || user.privacyProcessingBlocked) {
    const query = new URLSearchParams({reason: user.privacyProcessingBlocked ? 'blocked' : 'legal-update'});
    if (returnUrl) query.set('returnUrl', returnUrl);
    return `/cuenta/privacidad-datos?${query}`;
  }
  if (!returnUrl) return dashboardUrl;

  const parsed = new URL(returnUrl, APP_ORIGIN);
  const createsQuotation = parsed.searchParams.get('crearCotizacion') === '1';
  if (createsQuotation && user.role !== 'maestro') return dashboardUrl;

  return returnUrl;
}

export function localQuotationAuthId(returnUrl: string | null): string | null {
  if (!returnUrl) return null;
  try {
    const url = new URL(returnUrl, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || url.pathname !== '/dashboard/maestro/cotizaciones/nuevo' || url.searchParams.get('descargar') !== '1') return null;
    const id = url.searchParams.get('cotizacionLocal');
    return id && /^[a-zA-Z0-9-]{1,100}$/.test(id) ? id : null;
  } catch { return null; }
}
