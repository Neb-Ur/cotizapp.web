import {emptyWorkBudget,normalizeWorkBudget,type WorkBudget,type CostEntry} from '../../../../functions/src/domain/work-budget';
export * from '../../../../functions/src/domain/work-budget';
/** Browser drafts may contain an unfinished number input. Restore the editor so it can be corrected. */
export function restoreWorkBudgetDraft(value:unknown):WorkBudget {
 try{return normalizeWorkBudget(value);}catch{}
 const v=value as any;
 if(!v||v.version!==1)return emptyWorkBudget();
 const rows=(input:any):CostEntry[]=>Array.isArray(input)?input.slice(0,50).filter(row=>row&&typeof row==='object').map(row=>({description:typeof row.description==='string'?row.description.slice(0,200):'',unit:['trabajo','hora','jornada','unidad'].includes(row.unit)?row.unit:'trabajo',quantity:(typeof row.quantity==='number'?row.quantity:null) as number,unitPrice:(typeof row.unitPrice==='number'?row.unitPrice:null) as number})):[];
 return {...emptyWorkBudget(),...(v.templateId==='painting-v1'?{templateId:'painting-v1' as const}:{}),enabled:v.enabled===true,clientName:typeof v.clientName==='string'?v.clientName.slice(0,200):'',scope:typeof v.scope==='string'?v.scope.slice(0,3000):'',terms:typeof v.terms==='string'?v.terms.slice(0,2000):'',labor:rows(v.labor),expenses:rows(v.expenses),markupPercent:(typeof v.markupPercent==='number'?v.markupPercent:null) as number,discloseCosts:v.discloseCosts===true};
}
