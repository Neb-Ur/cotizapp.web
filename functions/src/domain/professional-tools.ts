/** Private, owner-scoped business information. Never included in store verification. */
export const MAX_SAVED_QUOTATIONS = 50;
export interface ClientContact {id:string;name:string;phone:string;email:string;address:string;}
export interface ProfessionalProfile {businessName:string;phone:string;email:string;address:string;defaultTerms:string;logo?:{data:string;width:number;height:number};}
export interface ProfessionalTools {version:1;revision:number;clients:ClientContact[];profile:ProfessionalProfile;}
export interface LedgerEntry {id:string;date:string;kind:'purchase'|'labor'|'expense'|'payment';description:string;quantity:number;unitPrice:number;}
export interface WorkLedger {version:1;revision:number;entries:LedgerEntry[];closed:boolean;}
export class ProfessionalToolsError extends Error {}
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
function positive(v:unknown,max:number,zero=false):number{if(typeof v!=='number'||!Number.isFinite(v)||v<(zero?0:0.001)||v>max)throw new ProfessionalToolsError('Revisa las cantidades y los montos.');return v;}
export function normalizeContact(v:any):ClientContact {
 if(!v||typeof v!=='object'||!str(v.name,200))throw new ProfessionalToolsError('Ingresa el nombre del cliente.');
 const email=str(v.email,254);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ProfessionalToolsError('Revisa el correo del cliente.');
 return {id:str(v.id,100),name:str(v.name,200),phone:str(v.phone,50),email,address:str(v.address,500)};
}
export function normalizeProfessionalProfile(v:any):ProfessionalProfile {
 v=v||{};const email=str(v.email,254);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ProfessionalToolsError('Revisa tu correo profesional.');
 const profile:ProfessionalProfile={businessName:str(v.businessName,160),phone:str(v.phone,50),email,address:str(v.address,500),defaultTerms:str(v.defaultTerms,2000)};
 if(v.logo!=null){
  if(typeof v.logo.data!=='string'||v.logo.data.length>140000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(v.logo.data)||!Number.isInteger(v.logo.width)||!Number.isInteger(v.logo.height)||v.logo.width<1||v.logo.height<1||v.logo.width>600||v.logo.height>600)throw new ProfessionalToolsError('Usa un logo JPEG de hasta 600 píxeles y 100 KB.');
  profile.logo={data:v.logo.data,width:v.logo.width,height:v.logo.height};
 }return profile;
}
export function normalizeProfessionalTools(v:any):ProfessionalTools {
 if(v!=null&&(v.version!==1||!Array.isArray(v.clients)||v.clients.length>200))throw new ProfessionalToolsError('La agenda admite hasta 200 clientes.');
 const clients=(v?.clients||[]).map(normalizeContact);const ids=new Set<string>();
 for(const c of clients){if(!c.id||ids.has(c.id))throw new ProfessionalToolsError('Cada cliente debe tener un identificador único.');ids.add(c.id);}
 return {version:1,revision:Number.isSafeInteger(v?.revision)&&v.revision>=0?v.revision:0,clients,profile:normalizeProfessionalProfile(v?.profile)};
}
export function normalizeWorkLedger(v:any):WorkLedger {
 if(v==null)return {version:1,revision:0,entries:[],closed:false};
 if(v.version!==1||!Array.isArray(v.entries)||v.entries.length>500||typeof v.closed!=='boolean')throw new ProfessionalToolsError('Revisa el registro de la obra (máximo 500 movimientos).');
 const ids=new Set<string>();
 const entries:LedgerEntry[]=v.entries.map((e:any)=>{
  const id=str(e?.id,100),description=str(e?.description,300),date=str(e?.date,10);
  if(!id||ids.has(id)||!description||!['purchase','labor','expense','payment'].includes(e.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new ProfessionalToolsError('Completa descripción, fecha válida y tipo de cada movimiento.');
  ids.add(id);return {id,date,kind:e.kind,description,quantity:positive(e.quantity,1e6),unitPrice:Math.round(positive(e.unitPrice,1e9))};
 });
 if(entries.reduce((s,e)=>s+Math.round(e.quantity*e.unitPrice),0)>1e12)throw new ProfessionalToolsError('Los movimientos superan el monto permitido.');
 return {version:1,revision:Number.isSafeInteger(v.revision)&&v.revision>=0?v.revision:0,closed:v.closed,entries};
}
export function ledgerTotals(v:WorkLedger,total:number,budgetedCost:number){
 const l=normalizeWorkLedger(v),sum=(kind:LedgerEntry['kind'])=>l.entries.filter(e=>e.kind===kind).reduce((s,e)=>s+Math.round(e.quantity*e.unitPrice),0);
 const purchases=sum('purchase'),labor=sum('labor'),expenses=sum('expense'),paid=sum('payment'),cost=purchases+labor+expenses;
 return {purchases,labor,expenses,paid,cost,balance:Math.max(0,total-paid),credit:Math.max(0,paid-total),profit:total-cost,cash:paid-cost,variance:budgetedCost-cost,closed:l.closed};
}
