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
it('prints the advisory purchase period and allows old quotations to be exported',async()=>{
 const file=buildQuotationPdfFile({...input,pricesCapturedAt:'2026-10-09T12:00:00Z',validUntil:'2026-10-19T12:00:00Z',exportedAt:new Date('2026-10-10T12:00:00Z')});
 const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(file);});
 expect(text).toContain('Plazo orientativo de compra: 10 dias');expect(text).not.toContain('Despacho no incluido');
 expect(()=>buildQuotationPdfFile({...input,validUntil:'2026-10-19T12:00:00Z',exportedAt:new Date('2026-10-19T12:00:00Z')})).not.toThrow();
});
it('includes the server-issued code used to verify the PDF',async()=>{
 const file=buildQuotationPdfFile({...input,verificationCode:'FND-AAAA-BBBB-CCCC-DDDD'});
 const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(file);});expect(text).toContain('FND-AAAA-BBBB-CCCC-DDDD');
});

describe('work budget PDF',()=>{
 const budget:any={version:1,enabled:true,clientName:'Cliente de prueba',scope:'Pintar living y reparar superficie',terms:'Plazo acordado: tres jornadas',labor:[{description:'Preparar y pintar',quantity:2,unit:'jornada',unitPrice:50000}],expenses:[{description:'Traslado',quantity:1,unit:'trabajo',unitPrice:10000}],markupPercent:25,discloseCosts:false};
 const read=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(file);});
 it('shows scope and sale total without embedding private unit costs, supplier prices or markup',async()=>{
  const text=await read(buildQuotationPdfFile({...input,workBudget:budget,verificationCode:'TRV-TEST'}));
  expect(text).toContain('PRESUPUESTO DE TRABAJO');expect(text).toContain('Cliente de prueba');expect(text).toContain('140.000');
  expect(text).not.toContain('50.000');expect(text).not.toContain('10.000');expect(text).not.toContain('Recargo sobre costos');expect(text).not.toContain('Ferreter');
  expect(text).toContain('verificacion de materiales');expect(text).toContain('no valida mano de obra');
 });
 it('includes the private breakdown only when the maestro explicitly enables it',async()=>{
  const text=await read(buildQuotationPdfFile({...input,workBudget:{...budget,discloseCosts:true}}));
  expect(text).toContain('DESGLOSE INTERNO');expect(text).toContain('50.000');expect(text).toContain('28.000');expect(text).toContain('Recargo sobre costos');
 });
 it('allows a labor-only budget and blocks any material with no available price',()=>{
  const empty=buildQuotationOptimization([],[]);expect(buildQuotationPdfFile({...input,quotation:empty,workBudget:budget}).type).toBe('application/pdf');
  expect(()=>buildQuotationPdfFile({...input,quotation:buildQuotationOptimization([{productName:'Missing',quantity:1}],[]),workBudget:budget})).toThrow('sin oferta');
 });
});
it('blocks an unfinished painting template before creating a client PDF',()=>{
 const workBudget={version:1 as const,enabled:true,templateId:'painting-v1' as const,clientName:'',scope:'Pintura',terms:'',markupPercent:0,discloseCosts:false,labor:[{description:'Aplicar pintura',unit:'trabajo' as const,quantity:1,unitPrice:0}],expenses:[]};
 expect(()=>buildQuotationPdfFile({...input,workBudget})).toThrow('Completa los costos');
 workBudget.labor[0].unitPrice=50000;expect(()=>buildQuotationPdfFile({...input,workBudget})).not.toThrow();
});
it('includes ceramic measurements and box assumptions in material and work PDFs while keeping internal costs private',async()=>{
 const tilePlan={version:1 as const,priceUnitConfirmed:true as const,spaces:[{name:'Cocina',length:4,width:3,excludedArea:1}],wastePercent:10,coveragePerBox:2,productId:'tile',productName:'Cerámica de piso'};
 const workBudget={version:1 as const,enabled:true,templateId:'tiles-v1' as const,clientName:'Cliente',scope:'Instalar revestimiento',terms:'Acordar fecha',labor:[{description:'Instalación',unit:'trabajo' as const,quantity:1,unitPrice:50000}],expenses:[],markupPercent:25,discloseCosts:false};
 const read=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(file);});
 for(const budget of [undefined,workBudget]){const text=await read(buildQuotationPdfFile({...input,tilePlan,workBudget:budget}));expect(text).toContain('ESTIMACION DE CERAMICAS');expect(text).toContain('Cocina');expect(text).toContain('7 caja');expect(text).toContain('2 m2/caja');if(budget){expect(text).not.toContain('Costo unitario:');expect(text).not.toContain('Recargo sobre costos');}}
});
it('includes saved professional contacts and construction assumptions but excludes private accounting',async()=>{
 const budget:any={version:1,enabled:true,clientName:'Ana',scope:'Obra',terms:'Anticipo acordado',labor:[{description:'Instalación',unit:'trabajo',quantity:1,unitPrice:100000}],expenses:[],markupPercent:20,discloseCosts:false,client:{id:'c',name:'Ana',phone:'555123',email:'ana@example.com',address:'Calle Cliente'},professional:{businessName:'Constructora Ejemplo',phone:'555456',email:'contacto@example.com',address:'Oficina',defaultTerms:''},constructionPlans:[{version:1,kind:'slab',length:5,width:4,excludedArea:0,wastePercent:10,coverage:1,thicknessCm:10,faces:1,note:'Especificación de proyecto'}],ledger:{entries:[{description:'PRIVATE_PAYMENT'}]}};
 const file=buildQuotationPdfFile({...input,workBudget:budget});
 const text=await new Promise<string>(resolve=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.readAsText(file);});
 expect(text).toContain('Constructora Ejemplo');expect(text).toContain('ana@example.com');expect(text).toContain('2.200 m3');expect(text).not.toContain('PRIVATE_PAYMENT');expect(text).not.toContain('Recargo sobre costos');
});
