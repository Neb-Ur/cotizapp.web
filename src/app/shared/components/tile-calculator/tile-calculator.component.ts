import {Component,Input,Output,EventEmitter,OnChanges,SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CatalogProduct} from '../../../core/models/app.models';
import {TilePlan,calculateTiles,normalizeTilePlan} from '../../../core/utils/work-budget.util';
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
@Component({selector:'app-tile-calculator',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./tile-calculator.component.html',styleUrl:'./tile-calculator.component.scss'})
export class TileCalculatorComponent implements OnChanges {
 @Input() products:CatalogProduct[]=[];
 @Input() plan?:TilePlan;
 @Input() busy=false;
 @Output() applyPlan=new EventEmitter<TilePlan>();
 protected form:any={version:1,spaces:[{name:'Espacio 1',length:null,width:null,excludedArea:0}],wastePercent:10,coveragePerBox:null,productId:'',productName:'',priceUnitConfirmed:false};
 protected query='';
 protected applied='';
 ngOnChanges(changes:SimpleChanges){if(changes['plan']){if(this.plan){this.form=structuredClone(this.plan);this.applied=JSON.stringify(this.form);}else this.applied='';}}
 protected get matches(){const q=normalized(this.query);return this.products.filter(product=>{
  const name=normalized(product.name),type=normalized(product.productType || ''),unit=normalized(product.unitLabel || '');
  return /ceramic|porcelanato|gres/.test(name+' '+type)&&!/adhesivo|pegamento|frague|broca|cortador|cortadora|disco|perfil|soporte|placa|ladrillo|cruceta|separador|nivelador|limpiador|sellador|mortero|llana/.test(name)
   &&!['m2','m²','metro cuadrado','metros cuadrados','palmeta','pieza'].includes(unit)
   &&(!q||normalized([product.name,product.brand,product.productType].join(' ')).includes(q));
 }).slice(0,100);}
 protected get selected(){return this.matches.find(product=>(product.masterProductId||product.id)===this.form.productId);}
 protected get result(){try{return calculateTiles(this.form);}catch{return null;}}
 protected get error(){try{calculateTiles(this.form);return '';}catch(error){return error instanceof Error?error.message:'Revisa las medidas.';}}
 protected get alreadyApplied(){return this.applied===JSON.stringify(this.form);}
 protected clearSelection(){this.form.productId='';this.form.productName='';this.form.coveragePerBox=null;this.form.priceUnitConfirmed=false;}
 protected selectProduct(){this.form.productName=this.selected?.name || '';this.form.coveragePerBox=null;this.form.priceUnitConfirmed=false;}
 protected addSpace(){if(this.form.spaces.length<30)this.form.spaces.push({name:`Espacio ${this.form.spaces.length+1}`,length:null,width:null,excludedArea:0});}
 protected removeSpace(index:number){if(this.form.spaces.length>1)this.form.spaces.splice(index,1);}
 protected add(){if(!this.selected||!this.result||!this.form.priceUnitConfirmed||this.busy||this.alreadyApplied)return;
  this.form.productName=this.selected.name;const plan=normalizeTilePlan(this.form)!;this.applyPlan.emit(plan);this.applied=JSON.stringify(plan);this.form=structuredClone(plan);
 }
}
