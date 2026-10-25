export type ConstructionKind='floor'|'partition'|'slab';
export interface ConstructionPlan {version:1;kind:ConstructionKind;length:number;width:number;excludedArea:number;wastePercent:number;coverage:number;thicknessCm:number;faces:number;note:string;}
export class ConstructionError extends Error {}
export function calculateConstruction(p:ConstructionPlan){
 const n=(v:number,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new ConstructionError('Revisa las medidas, el adicional y la presentación del material.');return v;};
 if(!['floor','partition','slab'].includes(p.kind)||p.version!==1)throw new ConstructionError('Selecciona un cálculo válido.');
 const area=n(p.length,.01,10000)*n(p.width,.01,10000)-n(p.excludedArea,0,1e8);
 if(area<=0)throw new ConstructionError('La superficie neta debe ser mayor que cero.');
 const faces=p.kind==='partition'?n(p.faces,1,2):1;if(!Number.isInteger(faces))throw new ConstructionError('Selecciona una o dos caras.');
 const waste=n(p.wastePercent,0,100),coverage=p.kind==='slab'?1:n(p.coverage,.001,10000);
 const required=area*(1+waste/100)*faces;
 const volume=p.kind==='slab'?required*n(p.thicknessCm,1,200)/100:0;
 const packages=p.kind==='slab'?0:Math.ceil(Number((required/coverage).toPrecision(12)));
 if(packages>1e6||volume>1e6)throw new ConstructionError('El cálculo supera el tamaño permitido.');
 return {area,required,packages,volume,unit:p.kind==='slab'?'m³':p.kind==='partition'?'planchas':'cajas'};
}
export function normalizeConstructionPlan(v:any):ConstructionPlan {
 calculateConstruction(v);
 return {version:1,kind:v.kind,length:v.length,width:v.width,excludedArea:v.excludedArea,wastePercent:v.wastePercent,coverage:v.kind==='slab'?1:v.coverage,thicknessCm:v.kind==='slab'?v.thicknessCm:1,faces:v.kind==='partition'?v.faces:1,note:typeof v.note==='string'?v.note.trim().slice(0,500):''};
}
