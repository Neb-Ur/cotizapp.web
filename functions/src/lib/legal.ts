export const CURRENT_TERMS_VERSION = '1.1';
export const CURRENT_PRIVACY_VERSION = '1.2';
export const CURRENT_STORE_AGREEMENT_VERSION = '1.1';
export const CURRENT_STORE_AGREEMENT_EFFECTIVE_DATE = '2026-10-05';

export const STORE_AGREEMENT_PROVIDER = {
  legalName: process.env['COTIZAPP_LEGAL_NAME'] || 'Rubén Benavides',
  taxId: process.env['COTIZAPP_TAX_ID'] || '',
  address: process.env['COTIZAPP_LEGAL_ADDRESS'] || '',
  legalRepresentative: process.env['COTIZAPP_LEGAL_REPRESENTATIVE'] || '',
  legalEmail: process.env['COTIZAPP_LEGAL_EMAIL'] || '',
  contactPath: '/contacto'
} as const;

export const STORE_AGREEMENT_CLAUSES = [
  { id: 'pilot-scope', title: 'Participación en la marcha blanca',
    text: 'La Ferretería autoriza publicar su catálogo para búsquedas, comparaciones y cotizaciones. Findi no confirma compras, acepta pedidos, reserva stock ni recibe pagos por productos. La venta se concreta directamente con la Ferretería. Este acuerdo no autoriza cobros a la Ferretería; cualquier servicio pagado requiere condiciones y aceptación separadas.' },
  { id: 'catalog-accuracy', title: 'Precios, stock y contacto',
    text: 'La Ferretería entrega información veraz y mantiene actualizados sus productos, precios, stock y contacto comercial. Los precios son finales con IVA incluido; Findi no agrega IVA. El stock publicado es el informado por la Ferretería y no constituye una reserva. Las diferencias deben corregirse sin demora.' },
  { id: 'intellectual-property', title: 'Autorización del catálogo',
    text: 'La persona que acepta declara estar autorizada para representar a la Ferretería y aportar su catálogo. La Ferretería cuenta con los derechos necesarios sobre imágenes, marcas y descripciones. Autoriza su exhibición, normalización y comparación en Findi mientras participe, sin transferir su propiedad.' },
  { id: 'privacy-security', title: 'Datos y acceso',
    text: 'Se publican los datos comerciales autorizados para identificar y contactar al local. Las credenciales son personales y deben protegerse. La Ferretería no recibe automáticamente datos privados de maestros ni sus cotizaciones. Los datos personales se tratan conforme a la política de privacidad y las autorizaciones específicas.' },
  { id: 'term-deletion', title: 'Duración, retiro y consultas',
    text: 'El acuerdo rige desde su aceptación durante la participación en la marcha blanca. Cualquiera de las partes puede solicitar el término por el formulario de contacto, sin exigir un período mínimo. Findi retirará el catálogo al terminar; solo conservará evidencia necesaria para obligaciones legales o controversias. Puede retirar información falsa, infractora o insegura, indicando la causa cuando sea posible. Cada parte conserva sus propias obligaciones legales.' }
] as const;

export const PRIVACY_REQUEST_TYPES = [
  'access',
  'rectification',
  'deletion',
  'objection',
  'blocking',
  'portability'
] as const;

export type PrivacyRequestType = typeof PRIVACY_REQUEST_TYPES[number];

export function isPrivacyRequestType(value: unknown): value is PrivacyRequestType {
  return typeof value === 'string' && PRIVACY_REQUEST_TYPES.includes(value as PrivacyRequestType);
}

export function calendarDeadline(from: Date, days: number): string {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

export function conservativeBlockingDeadline(from: Date): string {
  // SLA interno más estricto que el máximo legal de 2 días hábiles. Usar días
  // corridos evita depender de un calendario de festivos incompleto.
  return calendarDeadline(from, 2);
}
