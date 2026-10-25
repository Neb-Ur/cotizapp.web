import {Component,Input,Output,EventEmitter,OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {calculateConstruction,normalizeConstructionPlan,type ConstructionKind,type ConstructionPlan} from '../../../../../functions/src/domain/construction-calculator';
import {WorkBudget} from '../../../core/utils/work-budget.util';
@Component({selector:'app-construction-calculator',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./construction-calculator.component.html',styleUrl:'../professional-tools/professional-tools.component.scss'})
export class ConstructionCalculatorComponent implements OnChanges {
 ngOnChanges(){for(const p of this.budget?.constructionPlans||[])this.forms[p.kind]=structuredClone(p);}
 @Input({required:true}) budget!:WorkBudget;@Input() busy=false;@Output() changed=new EventEmitter<void>();
 protected kind:ConstructionKind='floor';protected notice='';protected error='';
 protected forms:Record<ConstructionKind,any>={floor:this.initial('floor'),partition:this.initial('partition'),slab:this.initial('slab')};
 protected options=[{id:'floor' as const,name:'Piso flotante o vinílico'},{id:'partition' as const,name:'Tabiques'},{id:'slab' as const,name:'Radier / losa'}];
 private initial(kind:ConstructionKind){return {version:1,kind,length:null,width:null,excludedArea:0,wastePercent:10,coverage:null,thicknessCm:10,faces:2,note:''};}
 protected get form(){return this.forms[this.kind];}
 protected get result(){try{return calculateConstruction(this.form);}catch{return null;}}
 protected get validation(){try{calculateConstruction(this.form);return '';}catch(e){return (e as Error).message;}}
 protected restore(){const p=this.budget.constructionPlans?.find(x=>x.kind===this.kind);if(p)this.forms[this.kind]=structuredClone(p);this.notice='';this.error='';}
 protected save(){try{const p=normalizeConstructionPlan(this.form);this.budget.constructionPlans=[...(this.budget.constructionPlans||[]).filter(x=>x.kind!==p.kind),p];this.changed.emit();this.notice='Cálculo aplicado. Guarda la cotización para conservarlo. Agrega los productos y cantidades correspondientes en el catálogo.';this.error='';}catch(e){this.error=(e as Error).message;}}
 protected remove(kind:ConstructionKind){this.budget.constructionPlans=this.budget.constructionPlans?.filter(p=>p.kind!==kind);this.changed.emit();}
 protected title(kind:ConstructionKind){return this.options.find(o=>o.id===kind)?.name || kind;}
}
