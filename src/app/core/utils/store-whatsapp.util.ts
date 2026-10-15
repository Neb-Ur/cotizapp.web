import { productSlug } from './product-url.util';

export function storeWhatsappUrl(phone: string | undefined, storeName: string, productName = '', productPath = '', pilot = false): string | null {
  const raw = (phone || '').trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  let number = raw.replace(/\D/g, '').replace(/^00/, '');
  if (/^9\d{8}$/.test(number)) number = '56' + number;
  if (!/^[1-9]\d{7,14}$/.test(number)) return null;
  const name = storeName.trim() || 'buen día';
  const product = productName.trim();
  const greeting = `Hola, ${name}.${pilot ? ' Este es un mensaje de prueba desde Trovio.' : ' Los encontré en Trovio.'}`;
  let message = product
    ? `${greeting} Quisiera saber si tienen disponible el producto «${product}». ¿Me pueden confirmar el precio y cómo comprarlo?`
    : `${greeting} Quisiera consultar por la disponibilidad de un producto. ¿Me pueden ayudar?`;
  if (product) {
    const canonical = new URL('/productos/' + productSlug(product), 'https://cotizapp-d71c8.web.app');
    if (productPath.startsWith('/productos/')) canonical.pathname = productPath.split(/[?#]/)[0];
    message += '\n' + canonical.href;
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
