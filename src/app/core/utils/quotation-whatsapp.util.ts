export function quotationWhatsappUrl(phone: string, name: string, total: string, pilot = false, validUntil?: string, verificationCode?: string): string {
  const raw = phone.trim();
  if (!/^[+\d\s()-]+$/.test(raw)) throw new Error('Ingresa un número de WhatsApp válido con código de país.');
  let number = raw.replace(/\D/g, '');
  if (number.length === 9 && number.startsWith('9')) number = `56${number}`;
  if (!/^[1-9]\d{7,14}$/.test(number)) throw new Error('Ingresa un número válido, por ejemplo +56 9 1234 5678.');
  const message = `Te comparto mi cotización «${name.trim() || 'Materiales'}» realizada en Trovio. Total con IVA: ${total}. Te adjuntaré el PDF con el detalle.${verificationCode ? `\nCódigo de verificación: ${verificationCode}.` : ''}${validUntil ? `\nCompra recomendada dentro de 10 días, hasta el ${new Date(validUntil).toLocaleDateString('es-CL')}.` : ''}${pilot ? '\nPRUEBA: ferreterías ficticias, precios y stock simulados. No es una oferta comercial.' : '\nCotización referencial; confirma precios y stock antes de comprar.'}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
