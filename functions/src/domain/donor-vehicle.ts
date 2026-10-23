import {createHash} from 'node:crypto';
import {isOfferCondition} from './offer-condition.js';
export class DonorError extends Error {
 constructor(readonly code:string,message:string,readonly status=400){super(message);}
}
export const DONOR_SYSTEMS:Record<string,string[]>={
 'Motor':['Motor completo','Culata','Alternador','Motor de arranque','Radiador','Electroventilador','Compresor de aire acondicionado','Bomba de agua','Bomba de aceite','Bomba de combustible','Inyector','Cuerpo de aceleración','Filtro de aire','Múltiple de admisión','Múltiple de escape','Turbo','Cárter','Soporte de motor'],
 'Transmisión':['Caja de cambios','Embrague','Volante de motor','Semieje izquierdo','Semieje derecho','Palanca de cambios','Diferencial'],
 'Iluminación':['Foco delantero izquierdo','Foco delantero derecho','Neblinero izquierdo','Neblinero derecho','Foco trasero izquierdo','Foco trasero derecho','Tercera luz de freno'],
 'Carrocería':['Capó','Parachoques delantero','Parachoques trasero','Tapabarro izquierdo','Tapabarro derecho','Puerta delantera izquierda','Puerta delantera derecha','Puerta trasera izquierda','Puerta trasera derecha','Portalón','Espejo lateral izquierdo','Espejo lateral derecho','Parrilla frontal'],
 'Suspensión y dirección':['Amortiguador delantero izquierdo','Amortiguador delantero derecho','Amortiguador trasero','Bandeja de suspensión','Cremallera de dirección','Bomba de dirección','Maza de rueda','Llanta','Neumático'],
 'Frenos':['Disco de freno delantero','Cáliper izquierdo','Cáliper derecho','Bomba de freno','Servofreno','Módulo ABS'],
 'Interior':['Asiento delantero izquierdo','Asiento delantero derecho','Asiento trasero','Tablero','Volante','Panel de puerta','Cinturón de seguridad','Radio'],
 'Electrónica':['ECU','Panel de instrumentos','Alternador regulador','Sensor de oxígeno','Sensor de cigüeñal','Motor de limpiaparabrisas','Alzavidrio izquierdo','Alzavidrio derecho','Comando de luces']
};
export const donorTemplate=()=>Object.entries(DONOR_SYSTEMS).flatMap(([sistema,names])=>names.map(nombre=>({id:'pieza-'+createHash('sha256').update(sistema+':'+nombre).digest('hex').slice(0,16),sistema,nombre})));
export const donorOfferId=(vehicleId:string,itemId:string)=>'donor-'+createHash('sha256').update(vehicleId+':'+itemId).digest('hex');
export const donorRequestId=(vehicleId:string,itemId:string)=>'donor-request-'+createHash('sha256').update(vehicleId+':'+itemId).digest('hex');
export const donorStore=(store:any)=>['desarmaduria','repuestos'].includes(store?.tipoNegocio);
export const text=(value:unknown,max=120)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
export const samePart=(a:unknown,b:unknown)=>text(a).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===text(b).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validateDonorIdentity(input:any){
 if(!input||!text(input.marcaId)||!text(input.modeloId)||!Number.isInteger(input.anio)||input.anio<1886||input.anio>new Date().getFullYear()+1)throw new DonorError('DONOR_VEHICLE_INVALID','Selecciona marca, modelo y año válidos.');
}
export function normalizeDonorParts(input:unknown,previous:any[]=[]):any[]{
 if(!Array.isArray(input)||input.length>120)throw new DonorError('DONOR_PARTS_INVALID','Puedes guardar hasta 120 piezas por vehículo.');
 const ids=new Set<string>();
 const result=input.map((p:any)=>{
  if(!p||!/^[-a-zA-Z0-9_]{1,80}$/.test(p.id)||ids.has(p.id)||!text(p.nombre)||!isOfferCondition(p.condicion))throw new DonorError('DONOR_PART_INVALID','Revisa el nombre, identificador y estado de las piezas.');
  if(p.stock!==null && p.stock!==undefined && (!Number.isSafeInteger(p.stock) || p.stock<0 || p.stock>1))throw new DonorError('DONOR_STOCK_INVALID','Cada pieza de un vehículo admite una unidad. Usa 0 cuando ya no esté disponible.');
  ids.add(p.id);const before=previous.find(b=>b.id===p.id);
  const master=text(p.productoMaestroId)||null;
  if(before?.ofertaId&&before.productoMaestroId!==master)throw new DonorError('DONOR_MASTER_LOCKED','Una pieza publicada conserva su producto maestro. Elimina la publicación antes de cambiarlo.',409);
  return {id:p.id,nombre:text(p.nombre),sistema:text(p.sistema)||'Otros',seleccionada:p.seleccionada===true,precio:typeof p.precio==='number'&&Number.isFinite(p.precio)&&p.precio>=0?p.precio:null,stock:p.stock===0?0:1,condicion:p.condicion,productoMaestroId:master,ofertaId:before?.ofertaId||null,solicitudId:before?.solicitudId||null,fotosPublicacion:before?.fotosPublicacion||[],error:before?.error||'',estado:before?.estado||'borrador'};
 });
 for(const before of previous)if(!ids.has(before.id))result.push({...before,seleccionada:false});
 if(result.length>120)throw new DonorError('DONOR_PARTS_INVALID','Se alcanzó el máximo de 120 piezas.');
 return result;
}
export const validDonorPrice=(p:any)=>typeof p.precio==='number'&&Number.isFinite(p.precio)&&p.precio>0&&p.stock===1&&isOfferCondition(p.condicion)&&p.condicion!=='sin_especificar';
export const matchesDonor=(master:any,donor:any)=>!!donor&&Array.isArray(master?.compatibilidadVehiculos)&&master.compatibilidadVehiculos.some((a:any)=>a.marcaId===donor.marcaId&&a.modeloId===donor.modeloId&&Number.isInteger(a.anioDesde)&&Number.isInteger(a.anioHasta)&&a.anioDesde<=donor.anio&&a.anioHasta>=donor.anio);

// Model/year compatibility cannot turn a different component into this piece.
export function matchesDonorPart(master:any,donor:any,part:any):boolean {
 if(!matchesDonor(master,donor))return false;
 if(master.nombrePieza && !samePart(master.nombrePieza,part.nombre))return false;
 const variant=text(master.detalleVariante).replace(/^motor\s+/i,'');
 return !variant || !text(donor.motor) || samePart(variant,text(donor.motor).replace(/^motor\s+/i,''));
}
