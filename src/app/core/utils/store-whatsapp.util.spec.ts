import {it,expect} from 'vitest';
import {storeWhatsappUrl} from './store-whatsapp.util';
it('normalizes authorized numbers and includes product, local, canonical link and test notice',()=>{
 for(const phone of ['+56 9 9103 6780','991036780','0056991036780']){
  const url=new URL(storeWhatsappUrl(phone,'Desarmaduría & Taller','Foco Mahindra KUV 100 2016–2020','/productos/foco-kuv?foo=bar',true)!);
  expect(url.pathname).toBe('/56991036780');
  const text=url.searchParams.get('text')!;
  expect(text).toContain('Desarmaduría & Taller');expect(text).toContain('mensaje de prueba');expect(text).toContain('Foco Mahindra KUV 100 2016–2020');
  expect(text).toContain('https://trovio.cl/productos/foco-kuv');expect(text).not.toContain('foo=bar');
 }
});
it('uses a generic draft without invented product names and rejects invalid phones',()=>{
 const text=new URL(storeWhatsappUrl('+56991036780','Local')!).searchParams.get('text')!;
 expect(text).toContain('disponibilidad de un producto');expect(text).not.toContain('undefined');expect(text).not.toContain('mensaje de prueba');
 for(const phone of ['',undefined,'123','javascript:56991036780','+56991036780?text=x'])expect(storeWhatsappUrl(phone,'Local')).toBeNull();
});
it('ignores external product links',()=>{
 const url=new URL(storeWhatsappUrl('+56991036780','Local','Foco','https://example.invalid')!);
 expect(url.searchParams.get('text')).toContain('https://trovio.cl/productos/');
});
