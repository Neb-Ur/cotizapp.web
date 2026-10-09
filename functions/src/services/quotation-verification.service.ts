import { randomBytes } from 'node:crypto';
import { buildQuotationOptimization } from '../domain/quotation.js';
import { geographicDistanceKm } from '../lib/values.js';
export function newVerificationCode(): string {
  return 'TRV-' + randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
}
export function normalizeVerificationCode(value: unknown): string | null {
  const compact=String(value || '').toUpperCase().replace(/[\s-]/g,'');
  return /^(?:FND|TRV)[0-9A-F]{16}$/.test(compact) ? compact.slice(0,3)+'-'+compact.slice(3).match(/.{4}/g)!.join('-') : null;
}
export function verificationSnapshot(project: any, code=newVerificationCode(), now=new Date().toISOString()) {
  const proximity=project.proximity;
  const offers=(project.pricingOffers || []).filter((o:any)=>!proximity || (o.storeLatitude!==null&&o.storeLatitude!==undefined&&o.storeLongitude!==null&&o.storeLongitude!==undefined&&geographicDistanceKm(proximity,{latitude:o.storeLatitude,longitude:o.storeLongitude})<=proximity.radiusKm));
  const quotation=buildQuotationOptimization(project.items || [],offers,project.singleStoreName,project.singleStoreId);
  return {
    code, quotationReference:project.id, issuedAt:now, pricesCapturedAt:project.pricesCapturedAt || now,
    recommendedUntil:project.validUntil || new Date(Date.parse(now)+10*86400000).toISOString(),
    lines:quotation.lines.filter(line=>line.unitPrice>0&&line.bestStoreId).map(line=>({
      storeId:line.bestStoreId, storeName:line.bestStoreName,
      productId:line.productoMaestroId || offers.find((o:any)=>o.productoFerreteriaId===line.productoFerreteriaId)?.productoMaestroId || null,
      offerId:line.productoFerreteriaId || null, productName:line.productName,quantity:line.quantity,unitPrice:line.unitPrice,subtotal:line.subtotal
    }))
  };
}
export function storeVerificationView(record:any,storeId:string) {
  const lines=(record.lines || []).filter((line:any)=>line.storeId===storeId);
  if(!lines.length)return null;
  return {code:record.code,issuedAt:record.issuedAt,pricesCapturedAt:record.pricesCapturedAt || record.issuedAt,recommendedUntil:record.recommendedUntil,
    withinRecommendedPeriod:Date.parse(record.recommendedUntil)>Date.now(),
    pilot:lines.some((line:any)=>line.storeName.includes('(Prueba)')),lines:lines.map(({storeId:_,storeName:__,...line}:any)=>line),
    total:lines.reduce((sum:number,line:any)=>sum+line.subtotal,0),includesVat:true};
}
