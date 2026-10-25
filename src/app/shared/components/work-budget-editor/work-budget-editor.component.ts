import {Component,Input,Output,EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {WorkBudget,CostEntry,workBudgetTotals,applyWorkTemplate,hasWorkTemplate,workTemplatePending,type WorkTemplateId} from '../../../core/utils/work-budget.util';
@Component({selector:'app-work-budget-editor',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./work-budget-editor.component.html',styleUrl:'./work-budget-editor.component.scss'})
export class WorkBudgetEditorComponent {
 @Input({required:true}) budget!:WorkBudget;
 @Input() materials=0;
 @Input() incomplete=false;
 @Output() changed=new EventEmitter<void>();
 protected templateError='';
 protected get templatePending(){return workTemplatePending(this.budget);}
 protected hasTemplate(id:WorkTemplateId){return hasWorkTemplate(this.budget,id);}
 protected applyTemplate(id:WorkTemplateId){
  try{Object.assign(this.budget,applyWorkTemplate(this.budget,id));this.templateError='';this.changed.emit();}
  catch(error){this.templateError=error instanceof Error?error.message:'No se pudo agregar la plantilla.';}
 }
 protected get totals(){try{return workBudgetTotals(this.materials,this.budget);}catch{return null;}}
 protected get error(){try{workBudgetTotals(this.materials,this.budget);return '';}catch(error){return error instanceof Error?error.message:'Revisa los costos.';}}
 protected money(value:number){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value);}
 protected add(kind:'labor'|'expenses'){
  if(this.budget[kind].length>=50)return;
  this.budget[kind].push({description:kind==='labor'?'Mano de obra':'Gasto adicional',unit:'trabajo',quantity:1,unitPrice:0});this.changed.emit();
 }
 protected remove(kind:'labor'|'expenses',index:number){this.budget[kind].splice(index,1);this.changed.emit();}
 protected groups:{key:'labor'|'expenses';title:string;button:string}[]=[{key:'labor',title:'Mano de obra',button:'Agregar mano de obra'},{key:'expenses',title:'Otros gastos',button:'Agregar gasto'}];
 protected entryTotal(row:CostEntry){return Number.isFinite(row.quantity*row.unitPrice)?Math.round(row.quantity*row.unitPrice):0;}
}
