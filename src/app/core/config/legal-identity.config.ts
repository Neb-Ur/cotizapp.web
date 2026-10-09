/** Responsable de la marcha blanca. Publicar solo canales confirmados. */
export const LEGAL_IDENTITY = {
  legalName: 'Rubén Benavides',
  dataController: 'Rubén Benavides',
  contactPath: '/contacto',
  whatsappEnabled: true,
  whatsappLabel: '+56 9 9103 6780',
  whatsappUrl: 'https://wa.me/56991036780',
  supportHours: 'Lunes a viernes de 09:00 a 18:00, excepto festivos',
  termsLastUpdated: '5 de octubre de 2026',
  termsVersion: '1.1',
  privacyLastUpdated: '5 de octubre de 2026',
  privacyPolicyVersion: '1.2'
} as const;

export const STORE_ACCESS_WHATSAPP_MESSAGE = 'Hola, equipo Trovio. Quiero solicitar acceso para mi ferretería y conocer los pasos para incorporarla y publicar nuestro catálogo.';
export const STORE_ACCESS_WHATSAPP_URL = `${LEGAL_IDENTITY.whatsappUrl}?text=${encodeURIComponent(STORE_ACCESS_WHATSAPP_MESSAGE)}`;
