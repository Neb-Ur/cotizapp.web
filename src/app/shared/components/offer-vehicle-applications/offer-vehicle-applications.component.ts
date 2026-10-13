import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {VehicleCatalogService, VehicleCatalog, VehicleApplication} from '../../../core/services/vehicle-catalog.service';
@Component({selector:'app-offer-vehicle-applications',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./offer-vehicle-applications.component.html',styleUrl:'./offer-vehicle-applications.component.scss'})
export class OfferVehicleApplicationsComponent implements OnChanges {
  @Input() storeId = '';
  @Input() offerId = '';
  @Input() disabled = false;
  @Output() busyChange = new EventEmitter<boolean>();
  protected applications: VehicleApplication[] = [];
  protected references: VehicleCatalog = {brands:[],models:[]};
  protected canEdit = false;
  protected loading = false;
  protected saving = false;
  protected error = '';
  protected notice = '';
  private generation = 0;
  constructor(private readonly service: VehicleCatalogService, private readonly changeDetector: ChangeDetectorRef) {}
  ngOnChanges(changes:Record<string,unknown>):void { if (changes['storeId'] || changes['offerId']) void this.load(); }
  protected async load():Promise<void> {
    if (!this.storeId || !this.offerId) return;
    const generation = ++this.generation;
    this.loading=true;this.canEdit=false;this.error='';this.notice='';this.applications=[];
    try {
      const state=await this.service.offerApplications(this.storeId,this.offerId);
      const references=state.canEdit ? await this.service.publicCatalog() : {brands:[],models:[]};
      if(generation!==this.generation)return;
      this.applications=structuredClone(state.applications);this.canEdit=state.canEdit;this.references=references;
      // Retain existing declarations even when their model has been deactivated.
      for(const a of this.applications){
        if(!this.references.brands.some(b=>b.id===a.marcaId))this.references.brands.push({id:a.marcaId,nombre:a.marcaNombre||'Marca registrada',usos:['vehiculo']});
        if(!this.references.models.some(m=>m.id===a.modeloId))this.references.models.push({id:a.modeloId,marcaId:a.marcaId,nombre:a.modeloNombre||'Modelo registrado',activo:false});
      }
    } catch(error){if(generation===this.generation)this.error=error instanceof Error?error.message:'No se pudieron cargar las asociaciones.';}
    finally{if(generation===this.generation){this.loading=false;this.changeDetector.markForCheck();}}
  }
  protected models(a:VehicleApplication) { return this.references.models.filter(m=>m.marcaId===a.marcaId && (m.activo||m.id===a.modeloId)); }
  protected add():void { if(this.applications.length<20)this.applications.push({marcaId:'',modeloId:'',anioDesde:null,anioHasta:null}); }
  protected async save():Promise<void> {
    if(this.saving||this.disabled||!this.canEdit)return;
    this.saving=true;this.busyChange.emit(true);this.error='';this.notice='';
    try {
      const applications=this.applications.map(a=>({...a,anioHasta:a.anioHasta??a.anioDesde}));
      const saved=await this.service.saveOfferApplications(this.storeId,this.offerId,applications);
      this.applications=structuredClone(saved.applications);this.notice='Asociaciones de vehículos guardadas.';
    } catch(error){this.error=error instanceof Error?error.message:'No se pudieron guardar las asociaciones.';}
    finally{this.saving=false;this.busyChange.emit(false);this.changeDetector.markForCheck();}
  }
}
