export const CURRENT_TERMS_VERSION = '1.0';
export const CURRENT_PRIVACY_VERSION = '1.1';
export const CURRENT_STORE_AGREEMENT_VERSION = '1.0';
export const CURRENT_STORE_AGREEMENT_EFFECTIVE_DATE = '2026-10-03';

export const STORE_AGREEMENT_PROVIDER = {
  legalName: process.env['COTIZAPP_LEGAL_NAME'] || 'CotizApp (piloto; identidad legal pendiente de completar)',
  taxId: process.env['COTIZAPP_TAX_ID'] || 'Pendiente de completar',
  address: process.env['COTIZAPP_LEGAL_ADDRESS'] || 'Pendiente de completar',
  legalRepresentative: process.env['COTIZAPP_LEGAL_REPRESENTATIVE'] || 'Nombre del representante legal por definir',
  legalEmail: process.env['COTIZAPP_LEGAL_EMAIL'] || 'legal@cotizapp.cl'
} as const;

export const STORE_AGREEMENT_CLAUSES = [
  {
    id: 'catalog-accuracy',
    title: 'Exactitud, precio y stock',
    text: 'La Ferretería declara que los precios, stock, vigencia, condiciones y características que informa son completos y veraces. Debe actualizar los cambios sin demora y, como máximo, dentro de 24 horas desde que ocurran. Cada precio informado es el precio final al público, con IVA incluido. CotizApp no agrega IVA ni fija el precio de venta.'
  },
  {
    id: 'identity-branches',
    title: 'Identidad legal y sucursales',
    text: 'La Ferretería mantendrá vigente su razón social, RUT, nombre comercial, domicilio, canales de contacto y la identificación y ubicación de cada sucursal cuyos precios publique.'
  },
  {
    id: 'intellectual-property',
    title: 'Imágenes, marcas y descripciones',
    text: 'La Ferretería garantiza que cuenta con derechos o autorizaciones suficientes sobre imágenes, marcas, fichas y descripciones aportadas. Otorga a CotizApp una licencia no exclusiva, gratuita y limitada a operar, promocionar y mostrar el comparador mientras el contrato esté vigente.'
  },
  {
    id: 'liability-complaints',
    title: 'Responsabilidad y reclamos',
    text: 'La Ferretería responde por información falsa, desactualizada o infractora que haya proporcionado y atenderá los reclamos derivados de sus ofertas dentro de 5 días hábiles, sin perjuicio de plazos legales más breves.'
  },
  {
    id: 'catalog-data',
    title: 'Uso de datos del catálogo',
    text: 'CotizApp podrá normalizar, indexar, comparar, calcular precios por unidad y conservar evidencia histórica de los datos del catálogo para prestar el servicio, prevenir fraude, resolver reclamos y acreditar comparaciones. No adquiere la propiedad de las marcas ni del contenido original de la Ferretería.'
  },
  {
    id: 'moderation',
    title: 'Suspensión y retiro',
    text: 'CotizApp podrá ocultar ofertas, suspender publicaciones o terminar el acceso ante datos no verificables, incumplimientos legales, riesgos de seguridad o infracción contractual. Cuando sea razonable, informará la causa y permitirá subsanar; podrá actuar de inmediato para proteger a usuarios o terceros.'
  },
  {
    id: 'confidentiality-security',
    title: 'Confidencialidad y seguridad',
    text: 'Cada parte protegerá la información confidencial de la otra y aplicará controles de acceso, credenciales individuales, actualización de permisos y notificación oportuna de incidentes que puedan afectar los datos compartidos.'
  },
  {
    id: 'term-deletion',
    title: 'Vigencia, término y eliminación',
    text: 'El contrato rige desde su aceptación y es indefinido. Cualquiera de las partes podrá terminarlo mediante aviso escrito con 30 días de anticipación, salvo término inmediato por incumplimiento grave. Al terminar, se retirará el catálogo público y se eliminarán o anonimizarán los datos conforme a la matriz de conservación, salvo antecedentes que deban mantenerse por obligaciones legales, defensa de derechos, seguridad o trazabilidad.'
  }
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
