import {it,expect} from 'vitest';
import {quotationWhatsappUrl} from './quotation-whatsapp.util';
it('normalizes Chilean mobile numbers and encodes names, totals and the pilot warning',()=>{
 const url=new URL(quotationWhatsappUrl('9 1234 5678','Cocina & baño','$20.000',true));
 expect(url.pathname).toBe('/56912345678');expect(url.searchParams.get('text')).toContain('Cocina & baño');expect(url.searchParams.get('text')).toContain('locales ficticios');
});
it('rejects invalid recipients and supports international country codes',()=>{
 expect(()=>quotationWhatsappUrl('javascript:123','Trabajo','$1')).toThrow();expect(()=>quotationWhatsappUrl('123','Trabajo','$1')).toThrow();expect(quotationWhatsappUrl('+54 9 11 1234 5678','Trabajo','$1')).toContain('/5491112345678?');
});
it('uses the work budget amount without calling labor VAT verified by a store',()=>{
 const url=quotationWhatsappUrl('+56 9 1234 5678','Pintura','$200.000',false,undefined,'TRV-TEST',true);
 const message=decodeURIComponent(url);expect(message).toContain('Total presupuestado: $200.000');expect(message).toContain('verificación de materiales');expect(message).not.toContain('Total con IVA');
});
