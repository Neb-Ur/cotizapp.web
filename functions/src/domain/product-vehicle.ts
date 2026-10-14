import {createHash} from 'node:crypto';
import { normalizeVehicleApplications, type VehicleApplication } from './vehicle-application.js';
export function normalizeProductApplications(value: unknown): VehicleApplication[] {
  const applications = normalizeVehicleApplications(value);
  if (applications.some(a => a.anioDesde === null || a.anioHasta === null)) throw new Error('PRODUCT_VEHICLE_YEARS_REQUIRED');
  return applications;
}
export function automotiveProductName(part: string, applications: VehicleApplication[], variant = ''): string {
  const piece = part.trim().replace(/\s+/g, ' ');
  if (!piece || piece.length > 120 || variant.length > 120 || !applications.length) throw new Error('PRODUCT_VARIANT_INVALID');
  const first = applications[0];
  if (!first.marcaNombre || !first.modeloNombre) throw new Error('PRODUCT_VEHICLE_NAMES_REQUIRED');
  const years = first.anioDesde === first.anioHasta ? String(first.anioDesde) : `${first.anioDesde}–${first.anioHasta}`;
  const sameModel = applications.every(a => a.marcaId === first.marcaId && a.modeloId === first.modeloId);
  const rangeLabel = sameModel ? applications.map(a => a.anioDesde === a.anioHasta ? String(a.anioDesde) : `${a.anioDesde}–${a.anioHasta}`).join(', ') : years;
  return `${piece} ${first.marcaNombre} ${first.modeloNombre} ${rangeLabel}${variant.trim() ? ' · ' + variant.trim() : ''}${!sameModel && applications.length > 1 ? ` (+${applications.length - 1} aplicaciones)` : ''}`;
}
export function offerApplicationsWithinProduct(offer: VehicleApplication[], product: VehicleApplication[]): boolean {
  return offer.every(a => product.some(p => p.marcaId === a.marcaId && p.modeloId === a.modeloId && a.anioDesde !== null && a.anioHasta !== null && p.anioDesde !== null && p.anioHasta !== null && p.anioDesde <= a.anioDesde && p.anioHasta >= a.anioHasta));
}

export function automotiveIdentity(product: any): string {
 const text=(value: unknown)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 return createHash('sha256').update(JSON.stringify([product.familiaId,product.marcaId||'',text(product.nombrePieza),text(product.detalleVariante),(product.compatibilidadVehiculos||[]).map((a:VehicleApplication)=>[a.marcaId,a.modeloId,a.anioDesde,a.anioHasta]).sort()])).digest('hex');
}
