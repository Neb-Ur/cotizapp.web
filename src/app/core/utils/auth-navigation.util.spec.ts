import { vi, type Mock, type Mocked } from 'vitest';
import { SessionUser } from '../models/app.models';
import { resolvePostAuthUrl, sanitizeReturnUrl } from './auth-navigation.util';

const maestro = { role: 'maestro' } as SessionUser;
const ferreteria = { role: 'ferreteria' } as SessionUser;

describe('auth navigation', () => {
  it('sends a store with pending acceptance to its home even when the original destination was a long account page', () => {
    expect(resolvePostAuthUrl({ ...ferreteria, legalAcceptanceRequired: true }, '/cuenta/privacidad-datos', '/dashboard/ferreteria')).toBe('/dashboard/ferreteria');
    expect(resolvePostAuthUrl({ ...ferreteria, storeAgreementStatus: 'pendiente' }, '/cuenta/contrato-ferreteria', '/dashboard/ferreteria')).toBe('/dashboard/ferreteria');
  });
  it('keeps a local product return URL with its quotation intent', () => {
    const returnUrl = '/producto?product=Adhesivo%20PVC&crearCotizacion=1&cantidad=3';
    expect(sanitizeReturnUrl(returnUrl)).toBe(returnUrl);
    expect(resolvePostAuthUrl(maestro, returnUrl, '/dashboard/maestro')).toBe(returnUrl);
  });

  it('rejects external and authentication return URLs', () => {
    expect(sanitizeReturnUrl('//example.com/attack')).toBeNull();
    expect(sanitizeReturnUrl('https://example.com/attack')).toBeNull();
    expect(sanitizeReturnUrl('/login')).toBeNull();
    expect(sanitizeReturnUrl('/registro?returnUrl=/producto')).toBeNull();
  });

  it('does not send a non-maestro role into the quotation creation flow', () => {
    expect(resolvePostAuthUrl(
      ferreteria,
      '/producto?product=Cemento&crearCotizacion=1',
      '/dashboard/ferreteria'
    )).toBe('/dashboard/ferreteria');
  });
});

it('always starts a store on its dashboard, retaining normal public return URLs for maestros',()=>{
 expect(resolvePostAuthUrl({...ferreteria,storeAgreementStatus:'vigente'},'/productos/cemento','/dashboard/ferreteria')).toBe('/dashboard/ferreteria');
 expect(resolvePostAuthUrl(maestro,'/productos/cemento','/')).toBe('/productos/cemento');
});
it('preserves the product and modal intent through a mandatory legal update',()=>{
 const product='/productos/cemento?crearCotizacion=1&cantidad=3&ferreteriaId=store';
 const destination=resolvePostAuthUrl({...maestro,legalAcceptanceRequired:true},product,'/');
 expect(destination).toContain('/cuenta/privacidad-datos?');
 expect(new URL(destination,'https://findi.test').searchParams.get('returnUrl')).toBe(product);
});

it('recognizes only a local quotation PDF return and preserves its public back destination', async () => {
  const { localQuotationAuthId } = await import('./auth-navigation.util');
  expect(localQuotationAuthId('/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=guest-123&descargar=1')).toBe('guest-123');
  expect(localQuotationAuthId('https://example.com/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=guest-123&descargar=1')).toBeNull();
  expect(localQuotationAuthId('/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=../private&descargar=1')).toBeNull();
  expect(localQuotationAuthId('/producto?cotizacionLocal=guest-123&descargar=1')).toBeNull();
});
