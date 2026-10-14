import {CommonModule} from '@angular/common';
import {ChangeDetectorRef,Component,EventEmitter,Input,OnInit,Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {VehicleCatalogService,VehicleCatalog,VehicleApplication} from '../../../core/services/vehicle-catalog.service';
@Component({selector:'app-product-vehicle-fields',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./product-vehicle-fields.component.html'})
export class ProductVehicleFieldsComponent implements OnInit {
 @Input() applications:VehicleApplication[]=[];
 @Input() disabled=false;
 @Output() applicationsChange=new EventEmitter<VehicleApplication[]>();
 protected references:VehicleCatalog={brands:[],models:[]};
 protected error='';
 constructor(private readonly service:VehicleCatalogService,private readonly cd:ChangeDetectorRef){}
 ngOnInit(){void this.load();}
 protected async load(){try{this.references=await this.service.publicCatalog();this.error='';}catch{this.error='No se pudo cargar el catálogo vehicular.';}finally{this.cd.markForCheck();}}
 protected brands(){return [...this.references.brands,...this.applications.filter(a=>a.marcaId&&!this.references.brands.some(b=>b.id===a.marcaId)).map(a=>({id:a.marcaId,nombre:a.marcaNombre||'Marca registrada'}))];}
 protected models(a:VehicleApplication){return [...this.references.models.filter(m=>m.marcaId===a.marcaId),...this.applications.filter(p=>p.marcaId===a.marcaId&&p.modeloId&&!this.references.models.some(m=>m.id===p.modeloId)).map(p=>({id:p.modeloId,nombre:p.modeloNombre||'Modelo registrado'}))];}
 protected update(index:number,field:keyof VehicleApplication,value:any){
  const next=this.applications.map(a=>({...a}));const a=next[index];(a as any)[field]=value;
  if(field==='marcaId'||field==='modeloId'){a.anioDesde=null;a.anioHasta=null;}
  if(field==='marcaId'){a.modeloId='';a.modeloNombre='';a.marcaNombre=this.references.brands.find(b=>b.id===value)?.nombre;}
  if(field==='modeloId')a.modeloNombre=this.references.models.find(m=>m.id===value)?.nombre;
  this.applicationsChange.emit(next);
 }
 protected add(){this.applicationsChange.emit([...this.applications,{marcaId:'',modeloId:'',anioDesde:null,anioHasta:null}]);}
 protected remove(index:number){this.applicationsChange.emit(this.applications.filter((_,i)=>i!==index));}
}
