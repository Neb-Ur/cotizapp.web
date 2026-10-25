import {WorkBudgetError} from './work-budget.js';
export interface TileSpace {name:string;length:number;width:number;excludedArea:number;}
export interface TilePlan {version:1;priceUnitConfirmed:true;spaces:TileSpace[];wastePercent:number;coveragePerBox:number;productId:string;productName:string;}
const numeric=(value:unknown,min:number,max:number,label:string):number=>{
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new WorkBudgetError(`Revisa ${label}.`);
 return value;
};
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
export function calculateTiles(input:Pick<TilePlan,'spaces'|'wastePercent'|'coveragePerBox'>){
 if(!Array.isArray(input.spaces)||input.spaces.length<1||input.spaces.length>30)throw new WorkBudgetError('Agrega entre 1 y 30 espacios.');
 const spaces=input.spaces.map((space,index)=>{
  if(!space||typeof space!=='object')throw new WorkBudgetError('Revisa las medidas de cada espacio.');
  const length=numeric(space.length,0.01,10000,`el largo del espacio ${index+1}`),width=numeric(space.width,0.01,10000,`el ancho o alto del espacio ${index+1}`);
  const grossArea=length*width,excludedArea=numeric(space.excludedArea,0,grossArea,`el área a descontar del espacio ${index+1}`);
  if(excludedArea>=grossArea)throw new WorkBudgetError(`El espacio ${index+1} debe tener superficie mayor que cero.`);
  return {name:clean(space.name,100)||`Espacio ${index+1}`,length,width,excludedArea,area:grossArea-excludedArea};
 });
 const area=spaces.reduce((sum,space)=>sum+space.area,0),waste=numeric(input.wastePercent,0,100,'el adicional por cortes y pérdidas');
 const coverage=numeric(input.coveragePerBox,0.001,10000,'los m² que cubre cada caja');
 const requiredArea=area*(1+waste/100),boxes=Math.ceil(Number((requiredArea/coverage).toPrecision(12)));
 if(!Number.isSafeInteger(boxes)||boxes>1_000_000)throw new WorkBudgetError('El cálculo supera la cantidad permitida de cajas.');
 return {spaces,area,requiredArea,boxes,purchasedArea:boxes*coverage};
}
export function normalizeTilePlan(value:unknown):TilePlan|undefined{
 if(value==null)return undefined;
 if(typeof value!=='object'||Array.isArray(value)||(value as TilePlan).version!==1)throw new WorkBudgetError('Formato del cálculo de cerámicas no válido.');
 const v=value as TilePlan,result=calculateTiles(v);
 if(v.priceUnitConfirmed!==true)throw new WorkBudgetError('Confirma que el precio corresponde a una caja y sus m² de cobertura.');
 const productId=clean(v.productId,200),productName=clean(v.productName,200);
 if(!productId||!productName)throw new WorkBudgetError('Selecciona una cerámica o porcelanato del catálogo.');
 return {version:1,priceUnitConfirmed:true,spaces:result.spaces.map(({name,length,width,excludedArea})=>({name,length,width,excludedArea})),wastePercent:v.wastePercent,coveragePerBox:v.coveragePerBox,productId,productName};
}
