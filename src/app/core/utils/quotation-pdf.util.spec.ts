import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildQuotationPdfFile, shareQuotationPdf } from './quotation-pdf.util';
import { buildQuotationOptimization } from './quotation-optimizer.util';
const input = { projectName: 'Prueba IVA', maestroName: 'Maestro', quotation: buildQuotationOptimization([{ productName: 'Cemento', quantity: 2 }], [{ productName: 'Cemento', storeName: 'Ferretería A', price: 1000, stock: 5 }]) };
afterEach(() => vi.restoreAllMocks());
it('exports the store final price without another VAT charge', async () => {
  const file = buildQuotationPdfFile(input);
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(file);
  });
  expect(text).toContain('IVA incluido');
  expect(text).toContain('no constituye una compra, un pedido ni una reserva');
  expect(text).toContain('no procesa compras');
  expect(text).toContain('2.000');
  expect(text).not.toContain('2.380');
  expect(text).not.toContain('IVA (19%)');
});
it('reports a cancelled share without claiming success', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError')) });
  expect(await shareQuotationPdf(input)).toBe('cancelled');
});
it('reports a completed native share', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
  expect(await shareQuotationPdf(input)).toBe('shared');
});
it('includes description and an unmistakable pilot disclaimer in the PDF',async()=>{
 const file=buildQuotationPdfFile({...input,projectDescription:'Reparacion cocina',pilot:true});
 const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(file);});
 expect(text).toContain('Reparacion cocina');expect(text).toContain('SOLO PRUEBA');expect(text).toContain('precios y stock simulados');
});
it('prints the saved deadline and prevents an expired PDF from being exported',async()=>{
 const file=buildQuotationPdfFile({...input,pricesCapturedAt:'2026-10-09T12:00:00Z',validUntil:'2026-10-19T12:00:00Z',exportedAt:new Date('2026-10-10T12:00:00Z')});
 const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(file);});
 expect(text).toContain('Vigencia: 10 dias');expect(text).not.toContain('Despacho no incluido');
 expect(()=>buildQuotationPdfFile({...input,validUntil:'2026-10-19T12:00:00Z',exportedAt:new Date('2026-10-19T12:00:00Z')})).toThrow('venció');
});
