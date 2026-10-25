import {apiErrorMessage} from '../../../core/utils/api-error.util';
import {Component,OnInit,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ApiClientService} from '../../../core/services/api-client.service';
import {normalizeCatalogCalculationSpecs} from '../../../../../functions/src/domain/catalog-calculation-specs';
@Component({selector:'app-catalog-quality',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./catalog-quality.component.html',styleUrl:'../professional-tools/professional-tools.component.scss'})
export class CatalogQualityComponent implements OnInit {
 protected rows:any[]=[];protected query='';protected onlyPending=true;protected selected:any=null;protected form:any={};protected busy=false;protected error='';protected notice='';protected loaded=false;
 constructor(private api:ApiClientService,private cdr:ChangeDetectorRef){}
 ngOnInit(){this.load();}
 protected async load(){this.error='';try{this.rows=await this.api.get<any[]>('/admin/catalogo/calidad',true);this.loaded=true;}catch{this.error='No se pudo cargar la calidad del catálogo.';}finally{this.cdr.markForCheck();}}
 protected get pending(){return this.rows.filter(r=>!r.specs).length;}
 protected get matches(){const q=this.query.toLowerCase();return this.rows.filter(r=>(!this.onlyPending||!r.specs)&&r.name.toLowerCase().includes(q)).slice(0,60);}
 protected edit(r:any){this.selected=r;this.form=r.specs?structuredClone(r.specs):{saleUnit:'unidad',coveragePerPackage:null,litersPerPackage:null,paintCoverage:null,source:''};this.notice='';this.error='';}
 protected async save(clear=false){this.error='';this.notice='';try{
  const specs=clear?null:normalizeCatalogCalculationSpecs(this.form);this.busy=true;
  const result=await this.api.put<any>(`/admin/catalogo/${this.selected.id}/calculo`,{specs,reviewedAt:this.selected.reviewedAt},true);
  Object.assign(this.selected,{specs:result.calculationSpecs,reviewedAt:result.calculationSpecsReviewedAt});this.notice='Presentación técnica guardada. Disponible para los próximos cálculos.';
 }catch(e){this.error=apiErrorMessage(e,'No se pudo guardar.');}finally{this.busy=false;this.cdr.markForCheck();}}
}
