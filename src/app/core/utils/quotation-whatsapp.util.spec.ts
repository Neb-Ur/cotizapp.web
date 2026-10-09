import {it,expect} from 'vitest';
import {quotationWhatsappUrl} from './quotation-whatsapp.util';
it('normalizes Chilean mobile numbers and encodes names, totals and the pilot warning',()=>{
 const url=new URL(quotationWhatsappUrl('9 1234 5678','Cocina & baño','$20.000',true));
 expect(url.pathname).toBe('/56912345678');expect(url.searchParams.get('text')).toContain('Cocina & baño');expect(url.searchParams.get('text')).toContain('ferreterías ficticias');
});
it('rejects invalid recipients and supports international country codes',()=>{
 expect(()=>quotationWhatsappUrl('javascript:123','Trabajo','$1')).toThrow();expect(()=>quotationWhatsappUrl('123','Trabajo','$1')).toThrow();expect(quotationWhatsappUrl('+54 9 11 1234 5678','Trabajo','$1')).toContain('/5491112345678?');
});
