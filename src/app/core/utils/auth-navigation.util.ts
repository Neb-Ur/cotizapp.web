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
  if (user.role === 'ferreteria' && (user.legalAcceptanceRequired || user.storeAgreementStatus !== 'vigente')) return dashboardUrl;
  const returnUrl = sanitizeReturnUrl(requestedReturnUrl);
  if (!returnUrl) return dashboardUrl;

  const parsed = new URL(returnUrl, APP_ORIGIN);
  const createsQuotation = parsed.searchParams.get('crearCotizacion') === '1';
  if (createsQuotation && user.role !== 'maestro') return dashboardUrl;

  return returnUrl;
}
