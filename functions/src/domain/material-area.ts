/** Geometric estimates with explicit yields. No inferred mix ratios or invented catalog yields. */
export type AreaWorkKind='painting'|'tiles'|'floor'|'partition'|'slab'|'coverage';
export interface MaterialAreaPlan {version:1;kind:AreaWorkKind;area:number;wastePercent:number;coats:number;faces:number;thicknessCm:number;coverage:number|null;packageSize:number|null;confirmed:boolean;productId:string;productName:string;}
export const areaWorkLabels:Record<AreaWorkKind,string>={painting:'Pintura',tiles:'Cerámicas y porcelanatos',floor:'Piso flotante o vinílico',partition:'Tabiques',slab:'Radier / losa',coverage:'Otro material por superficie'};
export class MaterialAreaError extends Error{}
function n(v:unknown,min:number,max:number,label:string):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new MaterialAreaError(`Revisa ${label}.`);return v;}
export function calculateMaterialArea(p:MaterialAreaPlan){
 if(!p||p.version!==1||!Object.hasOwn(areaWorkLabels,p.kind))throw new MaterialAreaError('Selecciona un oficio válido.');
 const area=n(p.area,.01,1e7,'los m² totales'),waste=n(p.wastePercent,0,100,'el adicional por pérdidas');
 const coats=p.kind==='painting'?n(p.coats,1,20,'las manos de pintura'):1,faces=p.kind==='partition'?n(p.faces,1,2,'las caras a revestir'):1;
 if(!Number.isInteger(coats)||!Number.isInteger(faces))throw new MaterialAreaError('Las manos y las caras deben ser enteras.');
 const requiredArea=area*(1+waste/100)*faces;
 const volume=p.kind==='slab'?requiredArea*n(p.thicknessCm,1,200,'el espesor en cm')/100:0;
 const coverage=p.coverage==null?null:n(p.coverage,.001,10000,'el rendimiento o la cobertura');
 const pack=p.packageSize==null?null:n(p.packageSize,.001,100000,'el contenido o rendimiento del envase');
 const liters=p.kind==='painting'&&coverage?requiredArea*coats/coverage:null;
 const raw=p.kind==='painting'?(liters!=null&&pack?liters/pack:null):p.kind==='slab'?(pack?volume*1000/pack:null):(coverage?requiredArea/coverage:null);
 const quantity=raw==null?null:Math.ceil(Number(raw.toPrecision(12)));
 if(quantity!=null&&(!Number.isSafeInteger(quantity)||quantity>1e6))throw new MaterialAreaError('La estimación supera un millón de unidades.');
 if(volume>1e6)throw new MaterialAreaError('El volumen supera el tamaño permitido.');
 return {area,requiredArea,liters,volume,quantity,unit:p.kind==='painting'?'envases':p.kind==='tiles'||p.kind==='floor'?'cajas':p.kind==='partition'?'planchas':'unidades de venta'};
}
export function normalizeMaterialArea(v:any):MaterialAreaPlan{
 calculateMaterialArea(v);const str=(x:unknown)=>typeof x==='string'?x.trim().slice(0,200):'';
 return {version:1,kind:v.kind,area:v.area,wastePercent:v.wastePercent,coats:v.kind==='painting'?v.coats:1,faces:v.kind==='partition'?v.faces:1,thicknessCm:v.kind==='slab'?v.thicknessCm:1,coverage:v.coverage??null,packageSize:v.packageSize??null,confirmed:v.confirmed===true,productId:str(v.productId),productName:str(v.productName)};
}
export function estimateMaterialOffer(plan:MaterialAreaPlan,offer:{price:number;stock:number;measurementUnit?:string|null;measurementQuantity?:number|null;comparisonEligible?:boolean}){
 const p={...plan};const measure=offer.measurementQuantity;
 let source:'offer'|'entered'='entered';
 if(typeof measure==='number'&&Number.isFinite(measure)&&measure>0){
  if(p.kind==='painting'&&offer.measurementUnit==='l'){p.packageSize=measure;source='offer';}
  if(['tiles','floor','partition','coverage'].includes(p.kind)&&offer.measurementUnit==='m2'){p.coverage=measure;source='offer';}
  if(p.kind==='slab'&&offer.measurementUnit==='m3'){p.packageSize=measure*1000;source='offer';}
 }
 const result=calculateMaterialArea(p),quantity=result.quantity;
 const total=quantity!=null&&Number.isFinite(offer.price)&&offer.price>0?quantity*offer.price:null;
 if(total!=null&&total>1e12)throw new MaterialAreaError('El total supera el monto permitido.');
 return {...result,source,packageMeasure:p.kind==='painting'||p.kind==='slab'?p.packageSize:p.coverage,total,eligible:plan.confirmed&&quantity!=null&&total!=null&&offer.comparisonEligible!==false&&Number.isFinite(offer.stock)&&offer.stock>=quantity};
}
export function defaultAreaPlan(kind:AreaWorkKind='painting'):MaterialAreaPlan{return {version:1,kind,area:0,wastePercent:10,coats:2,faces:2,thicknessCm:10,coverage:null,packageSize:null,confirmed:false,productId:'',productName:''};}
export function suggestAreaKind(name:string):AreaWorkKind{
 const s=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/pintura|latex|esmalte|barniz|impermeabilizante/.test(s)&&!/brocha|rodillo|bandeja|pistola/.test(s))return 'painting';
 if(/hormigon|concreto|predosificado/.test(s))return 'slab';
 if(/ceramica|porcelanato|gres/.test(s)&&!/adhesivo|frague|broca|disco/.test(s))return 'tiles';
 if(/piso flotante|piso vinilico|piso laminado/.test(s))return 'floor';
 if(/yeso.carton|volcanita|placa.*yeso|fibrocemento/.test(s))return 'partition';return 'coverage';
}
