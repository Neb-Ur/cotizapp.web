import {Component,Input,Output,EventEmitter,OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CatalogProduct} from '../../../core/models/app.models';
import {PaintingPlan,calculatePainting,normalizePaintingPlan} from '../../../core/utils/work-budget.util';
@Component({selector:'app-painting-calculator',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./painting-calculator.component.html',styleUrl:'./painting-calculator.component.scss'})
export class PaintingCalculatorComponent implements OnChanges {
 @Input() products:CatalogProduct[]=[];
 @Input() plan?:PaintingPlan;
 @Input() busy=false;
 @Output() applyPlan=new EventEmitter<PaintingPlan>();
 protected form:any={version:1,length:null,height:null,surfaces:1,openings:0,coats:2,coverage:null,wastePercent:10,packLiters:null,productId:'',productName:''};
 protected query='';
 protected applied='';
 ngOnChanges(changes:any){if(changes.plan){if(this.plan){this.form={...this.plan};this.applied=JSON.stringify(this.form);}else this.applied='';}}
 protected clearSelection(){this.form.productId='';this.form.productName='';this.form.packLiters=null;this.form.coverage=null;}
 protected get matches(){const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const q=normalize(this.query);return this.products.filter(p=>{const t=normalize([p.name,p.productType].join(' '));return /pintura|latex|esmalte|barniz|impermeabilizante/.test(t)&&!/rodillo|brocha|bandeja|cinta|lija|pistola|mezclador/.test(normalize(p.name))&&(!q||normalize([p.name,p.brand,p.productType].join(' ')).includes(q));}).slice(0,100);}
 protected get selected(){return this.products.find(p=>(p.masterProductId||p.id)===this.form.productId);}
 protected get result(){try{return calculatePainting(this.form);}catch{return null;}}
 protected get error(){try{calculatePainting(this.form);return '';}catch(error){return error instanceof Error?error.message:'Revisa las medidas.';}}
 protected get alreadyApplied(){return this.applied===JSON.stringify(this.form);}
 protected selectProduct(){this.form.productName=this.selected?.name||'';this.form.packLiters=null;this.form.coverage=null;}
 protected add(){const product=this.selected;if(!product||!this.result||this.alreadyApplied||this.busy)return;this.form.productName=product.name;const plan=normalizePaintingPlan(this.form)!;this.applyPlan.emit(plan);this.applied=JSON.stringify(this.form);}
}
