import {normalizeContact,normalizeProfessionalProfile,type ClientContact,type ProfessionalProfile} from './professional-tools.js';
import {normalizeConstructionPlan,type ConstructionPlan} from './construction-calculator.js';
export interface CostEntry { description: string; unit: 'trabajo' | 'hora' | 'jornada' | 'unidad'; quantity: number; unitPrice: number; }
export type WorkTemplateId='painting-v1'|'tiles-v1'|'floor-v1'|'partition-v1'|'slab-v1';
export interface WorkBudget { client?:ClientContact; professional?:ProfessionalProfile; constructionPlans?:ConstructionPlan[]; templateId?: WorkTemplateId; templateIds?: WorkTemplateId[]; version: 1; enabled: boolean; clientName: string; scope: string; terms: string; labor: CostEntry[]; expenses: CostEntry[]; markupPercent: number; discloseCosts: boolean; }
export class WorkBudgetError extends Error {}
export const emptyWorkBudget = (): WorkBudget => ({version:1,enabled:false,clientName:'',scope:'',terms:'',labor:[],expenses:[],markupPercent:0,discloseCosts:false});
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
function number(value:unknown,min:number,max:number,label:string):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new WorkBudgetError(`Revisa ${label}.`);
 return value;
}
export function normalizeWorkBudget(value:unknown): WorkBudget {
 if(value==null)return emptyWorkBudget();
 if(typeof value!=='object'||Array.isArray(value))throw new WorkBudgetError('Revisa el presupuesto de trabajo.');
 const v=value as WorkBudget;
 if(v.version!==1||typeof v.enabled!=='boolean'||typeof v.discloseCosts!=='boolean')throw new WorkBudgetError('Formato de presupuesto no válido.');
 const extras:Partial<WorkBudget>={};
 try{if(v.client)extras.client=normalizeContact(v.client);if(v.professional)extras.professional=normalizeProfessionalProfile(v.professional);if(v.constructionPlans){if(!Array.isArray(v.constructionPlans)||v.constructionPlans.length>3)throw new Error('Usa hasta tres cálculos de construcción.');extras.constructionPlans=v.constructionPlans.map(normalizeConstructionPlan);}}catch(e){throw new WorkBudgetError(e instanceof Error?e.message:'Revisa los datos profesionales.');}
 if(!v.enabled)return {...emptyWorkBudget(),...extras,clientName:text(v.clientName,200),scope:text(v.scope,3000),terms:text(v.terms,2000)};
 const entries=(input:unknown):CostEntry[]=>{
  if(!Array.isArray(input)||input.length>50)throw new WorkBudgetError('Usa hasta 50 partidas por sección.');
  return input.map(row=>{
   if(!row||typeof row!=='object'||!['trabajo','hora','jornada','unidad'].includes(row.unit))throw new WorkBudgetError('Revisa la unidad de cada partida.');
   const description=text(row.description,200);
   if(!description)throw new WorkBudgetError('Indica una descripción para cada partida.');
   return {description,unit:row.unit,quantity:number(row.quantity,0.01,1_000_000,'la cantidad de cada partida'),unitPrice:Math.round(number(row.unitPrice,0,1_000_000_000,'el precio de cada partida'))};
  });
 };
 const labor=entries(v.labor),expenses=entries(v.expenses);
 if([...labor,...expenses].reduce((sum,row)=>sum+Math.round(row.quantity*row.unitPrice),0)>1_000_000_000_000)throw new WorkBudgetError('El costo del trabajo supera el máximo permitido.');
 return {...templateMetadata(v),...extras,version:1,enabled:v.enabled,clientName:text(v.clientName,200),scope:text(v.scope,3000),terms:text(v.terms,2000),labor,expenses,markupPercent:number(v.markupPercent,0,100,'el recargo sobre costos (0 a 100 %)'),discloseCosts:v.discloseCosts};
}
export function workBudgetTotals(materials:number,budget:WorkBudget) {
 const normalized=normalizeWorkBudget(budget);
 const sum=(entries:CostEntry[])=>entries.reduce((total,row)=>total+Math.round(row.quantity*row.unitPrice),0);
 const labor=normalized.enabled?sum(normalized.labor):0,expenses=normalized.enabled?sum(normalized.expenses):0;
 const materialTotal=Number.isFinite(materials)&&materials>=0?Math.round(materials):0;
 const cost=materialTotal+labor+expenses;
 const markup=normalized.enabled?Math.round(cost*normalized.markupPercent/100):0;
 return {materials:materialTotal,labor,expenses,cost,markup,total:cost+markup};
}
export interface PaintingPlan {version:1; length:number; height:number; surfaces:number; openings:number; coats:number; coverage:number; wastePercent:number; packLiters:number; productId:string; productName:string;}
export function calculatePainting(input:Pick<PaintingPlan,'length'|'height'|'surfaces'|'openings'|'coats'|'coverage'|'wastePercent'|'packLiters'>) {
 const length=number(input.length,0.01,10000,'el largo'),height=number(input.height,0.01,10000,'el alto');
 const surfaces=number(input.surfaces,1,1000,'la cantidad de superficies'),coats=number(input.coats,1,20,'las manos');
 if(!Number.isInteger(surfaces)||!Number.isInteger(coats))throw new WorkBudgetError('Superficies y manos deben ser números enteros.');
 const grossArea=length*height*surfaces,openings=number(input.openings,0,grossArea,'la superficie de puertas y ventanas');
 if(openings>=grossArea)throw new WorkBudgetError('La superficie a pintar debe ser mayor que cero.');
 const coverage=number(input.coverage,0.01,1000,'el rendimiento por litro y mano');
 const waste=number(input.wastePercent,0,100,'el porcentaje adicional'),pack=number(input.packLiters,0.01,10000,'los litros del envase');
 const area=grossArea-openings,liters=area*coats/coverage*(1+waste/100);
 const packages=Math.ceil(Number((liters/pack).toPrecision(12)));
 if(!Number.isSafeInteger(packages)||packages>1_000_000)throw new WorkBudgetError('El cálculo supera la cantidad permitida de envases.');
 return {area,liters,packages,purchasedLiters:packages*pack};
}
export function normalizePaintingPlan(value:unknown):PaintingPlan|undefined {
 if(value==null)return undefined;
 if(typeof value!=='object'||Array.isArray(value))throw new WorkBudgetError('Revisa el cálculo de pintura.');
 const v=value as PaintingPlan;
 if(v.version!==1)throw new WorkBudgetError('Formato del cálculo de pintura no válido.');
 calculatePainting(v);
 const productId=text(v.productId,200),productName=text(v.productName,200);
 if(!productId||!productName)throw new WorkBudgetError('Selecciona una pintura del catálogo.');
 return {version:1,length:v.length,height:v.height,surfaces:v.surfaces,openings:v.openings,coats:v.coats,coverage:v.coverage,wastePercent:v.wastePercent,packLiters:v.packLiters,productId,productName};
}

const templateIds:WorkTemplateId[]=['painting-v1','tiles-v1','floor-v1','partition-v1','slab-v1'];
function templateMetadata(value:WorkBudget):Pick<WorkBudget,'templateId'|'templateIds'>{
 const id=templateIds.includes(value.templateId as WorkTemplateId)?value.templateId:undefined;
 const ids=Array.isArray(value.templateIds)?[...new Set(value.templateIds.filter(id=>templateIds.includes(id)))]:[];
 return {...(id?{templateId:id}:{}),...(ids.length?{templateIds:ids}:{})};
}
export function hasWorkTemplate(budget:WorkBudget,id:WorkTemplateId):boolean{return budget.templateId===id || budget.templateIds?.includes(id)===true;}
/** Templates only add editable tasks. They never supply prices or material quantities. */
export function applyWorkTemplate(current:WorkBudget,id:WorkTemplateId):WorkBudget{
 const budget=structuredClone(current);
 if(hasWorkTemplate(budget,id))return budget;
 const painting=id==='painting-v1';
 const extraTasks:Partial<Record<WorkTemplateId,string[]>>={'floor-v1':['Revisión y nivelación de la base','Instalación de piso flotante o vinílico','Instalación de guardapolvos y remates','Limpieza final'],'partition-v1':['Trazado y estructura de tabique','Instalación de aislación','Revestimiento con planchas','Tratamiento de juntas','Limpieza final'],'slab-v1':['Preparación y compactación de terreno','Moldajes y preparación de base','Colocación y terminación de hormigón','Curado y protección','Limpieza final']};
 const descriptions=extraTasks[id] || (painting?['Protección y preparación de superficies','Aplicación de pintura','Limpieza final']:
  ['Retiro de revestimiento existente','Preparación de la base','Instalación de cerámicas o porcelanatos','Aplicación de fragüe','Limpieza final']);
 const tasks:CostEntry[]=descriptions.map(description=>({description,unit:'trabajo',quantity:1,unitPrice:0}));
 const expenseNames=painting?['Traslado']:['Traslado','Retiro de escombros'];
 const labor=tasks.filter(task=>!budget.labor.some(row=>row.description===task.description));
 const expenses:CostEntry[]=expenseNames.filter(description=>!budget.expenses.some(row=>row.description===description)).map(description=>({description,unit:'trabajo',quantity:1,unitPrice:0}));
 if(budget.labor.length+labor.length>50 || budget.expenses.length+expenses.length>50)throw new WorkBudgetError('No hay espacio para la plantilla. Quita partidas antes de agregarla.');
 const existing=templateIds.filter(t=>hasWorkTemplate(budget,t));
 return {...budget,enabled:true,templateId:budget.templateId || id,...(existing.length?{templateIds:[...existing,id]}:{}),
  scope:budget.scope || (extraTasks[id]?extraTasks[id]!.join(', ')+'. Acordar alcance, medidas y especificaciones antes de ejecutar.':painting?'Preparación de superficies, aplicación de pintura y limpieza final. Revisar con el cliente las reparaciones y superficies incluidas.':'Preparación de la base, instalación de cerámicas o porcelanatos, aplicación de fragüe y limpieza final. Acordar retiro del revestimiento anterior, reparaciones y disposición de escombros.'),
  labor:[...budget.labor,...labor],expenses:[...budget.expenses,...expenses]};
}
export function paintingBudgetTemplate(current:WorkBudget):WorkBudget{return applyWorkTemplate(current,'painting-v1');}
export function workTemplatePending(budget:WorkBudget):boolean{
 return budget.enabled && templateIds.some(id=>hasWorkTemplate(budget,id)) && [...budget.labor,...budget.expenses].some(row=>!(row.unitPrice>0));
}
/** Compatibility for consumers of the original painting template. */
export const paintingTemplatePending=workTemplatePending;
