import {Component,Input,Output,EventEmitter,OnChanges,SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';import {FormsModule} from '@angular/forms';
import {MaterialAreaPlan,AreaWorkKind,areaWorkLabels,defaultAreaPlan,suggestAreaKind,normalizeMaterialArea,calculateMaterialArea,estimateMaterialOffer} from '../../../../../functions/src/domain/material-area';
import {CatalogProduct,ProductStoreOfferRow} from '../../../core/models/app.models';
import {WorkBudget} from '../../../core/utils/work-budget.util';
@Component({selector:'app-material-area-calculator',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./material-area-calculator.component.html',styleUrl:'./material-area-calculator.component.scss'})
export class MaterialAreaCalculatorComponent implements OnChanges {
 @Input() budget?:WorkBudget;@Input() products:CatalogProduct[]=[];
 @Input() product?:{id:string;name:string;specs?:CatalogProduct['calculationSpecs']};
 @Input() offers:ProductStoreOfferRow[]=[];@Input() initialPlan?:MaterialAreaPlan;@Input() preferredKind?:AreaWorkKind;@Input() busy=false;
 @Output() changed=new EventEmitter<void>();@Output() planChange=new EventEmitter<MaterialAreaPlan|undefined>();
 @Output() compareProduct=new EventEmitter<MaterialAreaPlan>();@Output() offerSelected=new EventEmitter<{plan:MaterialAreaPlan;store:ProductStoreOfferRow;quantity:number}>();
 protected labels=areaWorkLabels;protected kinds=Object.keys(areaWorkLabels) as AreaWorkKind[];
 protected form:MaterialAreaPlan=defaultAreaPlan();protected search='';protected notice='';protected overrides:Record<string,number|null>={};protected yieldOverrides:Record<string,number|null>={};
 ngOnChanges(c:SimpleChanges){
  if(c['product']&&this.product&&c['product'].previousValue?.id!==this.product.id){this.form=defaultAreaPlan(suggestAreaKind(this.product.name));this.form.productId=this.product.id;this.form.productName=this.product.name;this.prefill(this.product.specs);this.overrides={};this.yieldOverrides={};}
  if(c['budget']&&this.budget){const saved=this.budget.materialPlans?.find(p=>p.kind===(this.preferredKind||this.form.kind)) || this.budget.materialPlans?.[0];if(saved)this.form=structuredClone(saved);}
  if(c['preferredKind']&&this.preferredKind){this.form=this.savedOrDefault(this.preferredKind);this.notice='';}
  if(c['initialPlan']&&this.initialPlan){try{const p=normalizeMaterialArea(this.initialPlan);if(!this.product||!p.productId||p.productId===this.product.id)this.form={...p,...(this.product?{productId:this.product.id,productName:this.product.name}:{})};}catch{}}
 }
 private savedOrDefault(kind:AreaWorkKind){const saved=this.budget?.materialPlans?.find(p=>p.kind===kind);return saved?structuredClone(saved):defaultAreaPlan(kind);}
 protected get result(){try{return calculateMaterialArea(this.form);}catch{return null;}}
 protected get validation(){try{calculateMaterialArea(this.form);return '';}catch(e){return (e as Error).message;}}
 protected get matches(){const q=this.search.toLowerCase();return this.products.filter(p=>(!q||[p.name,p.brand].join(' ').toLowerCase().includes(q))&&(suggestAreaKind(p.name)===this.form.kind || this.form.kind==='coverage')).slice(0,100);}
 protected selectKind(){const kind=this.form.kind;this.form=this.product?{...defaultAreaPlan(kind),productId:this.product.id,productName:this.product.name}:this.savedOrDefault(kind);if(this.product)this.prefill(this.product.specs);this.overrides={};this.yieldOverrides={};this.update();}
 private prefill(specs:CatalogProduct['calculationSpecs']){if(!specs)return;if(this.form.kind==='painting'&&specs.saleUnit==='envase'){this.form.coverage=specs.paintCoverage;this.form.packageSize=specs.litersPerPackage;}else if(['tiles','floor','partition','coverage'].includes(this.form.kind))this.form.coverage=specs.coveragePerPackage;}
 protected selectProduct(){const p=this.products.find(p=>(p.masterProductId||p.id)===this.form.productId);this.form.productName=p?.name||'';this.form.coverage=null;this.form.packageSize=null;this.prefill(p?.calculationSpecs);this.form.confirmed=false;this.update();}
 protected update(){this.notice='';try{this.planChange.emit(normalizeMaterialArea(this.form));}catch{this.planChange.emit(undefined);}}
 protected measurementChanged(){this.form.confirmed=false;this.update();}
 protected trackOffer=(_:number,row:{store:ProductStoreOfferRow})=>this.key(row.store);
 protected key(s:ProductStoreOfferRow){return s.offerId || s.storeId || s.storeName;}
 protected rowPlan(s:ProductStoreOfferRow):MaterialAreaPlan{const p={...this.form};if(p.kind==='painting'&&this.yieldOverrides[this.key(s)]!=null)p.coverage=this.yieldOverrides[this.key(s)];const value=this.overrides[this.key(s)];if(value!=null){if(p.kind==='painting'||p.kind==='slab')p.packageSize=value;else p.coverage=value;}return p;}
 protected row(s:ProductStoreOfferRow){try{const p=this.rowPlan(s);const custom=this.overrides[this.key(s)]!=null;return estimateMaterialOffer(p,custom?{...s,measurementQuantity:null}:s);}catch{return null;}}
 protected get rows(){return this.offers.map(store=>({store,estimate:this.row(store)})).sort((a,b)=>Number(!!b.estimate?.eligible)-Number(!!a.estimate?.eligible)||(a.estimate?.total??Infinity)-(b.estimate?.total??Infinity));}
 protected overrideChanged(){this.form.confirmed=false;this.update();}
 protected get measureLabel(){return this.form.kind==='painting'?'Litros por envase':this.form.kind==='slab'?'Litros de hormigón por unidad de venta':'m² por unidad de venta';}
 protected save(){try{const p=normalizeMaterialArea(this.form);if(!this.budget)return;this.budget.materialPlans=[...(this.budget.materialPlans||[]).filter(x=>x.kind!==p.kind),p];this.changed.emit();this.notice='Medidas guardadas en el presupuesto. Revisa rendimiento, presentación y cantidades antes de cotizar.';}catch(e){this.notice=(e as Error).message;}}
 protected compare(){if(!this.result||!this.form.productId)return;this.save();this.compareProduct.emit(normalizeMaterialArea(this.form));}
 protected choose(s:ProductStoreOfferRow){const r=this.row(s);if(!r?.eligible||r.quantity==null||this.busy)return;const p=this.rowPlan(s);if(r.source==='offer'){if(p.kind==='painting'||p.kind==='slab')p.packageSize=r.packageMeasure;else p.coverage=r.packageMeasure;}this.offerSelected.emit({plan:normalizeMaterialArea(p),store:s,quantity:r.quantity});}
 protected money(n:number){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);}
}
