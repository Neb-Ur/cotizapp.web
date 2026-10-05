/**
 * Identidad legal única de CotizApp.
 *
 * IMPORTANTE: estos valores son provisionales. Reemplázalos con los datos de
 * la sociedad constituida antes de habilitar una operación pública real.
 */
export const LEGAL_IDENTITY = {
  isProvisional: true,
  legalName: 'CotizApp (piloto; identidad legal pendiente de completar)',
  taxId: 'Pendiente de completar',
  registeredAddress: 'Pendiente de completar',
  legalRepresentative: 'Nombre del representante legal por definir',
  dataController: 'CotizApp (piloto; identidad legal pendiente de completar)',
  privacyOfficer: 'Encargado de Privacidad de CotizApp',
  legalEmail: 'legal@cotizapp.cl',
  privacyEmail: 'privacidad@cotizapp.cl',
  supportEmail: 'soporte@cotizapp.cl',
  formalNotificationMethod: 'Correo electrónico dirigido a legal@cotizapp.cl',
  supportHours: 'Lunes a viernes de 09:00 a 18:00, excepto festivos',
  whatsappEnabled: true,
  whatsappLabel: '+56 9 9103 6780',
  whatsappUrl: 'https://wa.me/56991036780',
  termsLastUpdated: '2 de octubre de 2026',
  termsVersion: '1.0',
  privacyLastUpdated: '2 de octubre de 2026',
  privacyPolicyVersion: '1.1'
} as const;

export const STORE_ACCESS_WHATSAPP_MESSAGE = 'Hola, equipo CotizApp. Quiero solicitar acceso para mi ferretería y conocer los pasos para incorporarla y publicar nuestro catálogo.';
export const STORE_ACCESS_WHATSAPP_URL = `${LEGAL_IDENTITY.whatsappUrl}?text=${encodeURIComponent(STORE_ACCESS_WHATSAPP_MESSAGE)}`;
