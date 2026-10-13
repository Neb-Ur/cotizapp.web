import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleCatalogService, VehicleCatalog, VehicleModel } from '../../../core/services/vehicle-catalog.service';
@Component({selector:'app-vehicle-catalog-admin',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./vehicle-catalog-admin.component.html',styleUrl:'./vehicle-catalog-admin.component.scss'})
export class VehicleCatalogAdminComponent implements OnInit {
  protected catalog:VehicleCatalog={brands:[],models:[]};
  protected loading=true;
  protected saving=false;
  protected error='';
  protected notice='';
  protected brandName='';
  protected existingBrandId='';
  protected selectedBrandId='';
  protected modelName='';
  protected editingId='';
  constructor(private readonly service:VehicleCatalogService,private readonly changeDetector:ChangeDetectorRef) {}
  ngOnInit():void { void this.load(); }
  protected get vehicleBrands() { return this.catalog.brands.filter(brand=>brand.usos.includes('vehiculo')); }
  protected get availableBrands() { return this.catalog.brands.filter(brand=>!brand.usos.includes('vehiculo')); }
  protected get models() { return this.catalog.models.filter(model=>model.marcaId===this.selectedBrandId); }
  protected async load():Promise<void> {
    this.loading=true;this.error='';
    try { this.catalog=await this.service.adminCatalog();if(!this.vehicleBrands.some(brand=>brand.id===this.selectedBrandId))this.selectedBrandId=this.vehicleBrands[0]?.id||''; }
    catch(error) { this.error=error instanceof Error?error.message:'No se pudo cargar el catálogo de vehículos.'; }
    finally { this.loading=false;this.changeDetector.markForCheck(); }
  }
  private async mutate(action:()=>Promise<unknown>,notice:string):Promise<void> {
    if(this.saving)return;this.saving=true;this.error='';this.notice='';
    try { await action();this.brandName='';this.existingBrandId='';this.resetModel();await this.load();if(!this.error)this.notice=notice; }
    catch(error) { this.error=error instanceof Error?error.message:'No se pudo guardar.'; }
    finally { this.saving=false;this.changeDetector.markForCheck(); }
  }
  protected addBrand():Promise<void> { return this.mutate(async()=>{const brand=await this.service.addBrand(this.brandName.trim());this.selectedBrandId=brand.id;},'Marca registrada para vehículos.'); }
  protected enableBrand():Promise<void> { return this.mutate(async()=>{const brand=await this.service.enableBrand(this.existingBrandId);this.selectedBrandId=brand.id;},'La marca conserva su uso actual y también admite vehículos.'); }
  protected editModel(model:VehicleModel):void { this.editingId=model.id;this.modelName=model.nombre; }
  protected resetModel():void { this.editingId='';this.modelName=''; }
  protected saveModel():Promise<void> { return this.mutate(()=>this.editingId?this.service.updateModel(this.editingId,{nombre:this.modelName.trim()}):this.service.addModel(this.selectedBrandId,this.modelName.trim()),'Modelo guardado.'); }
  protected toggleModel(model:VehicleModel):Promise<void> { return this.mutate(()=>this.service.updateModel(model.id,{activo:!model.activo}),'Estado del modelo actualizado.'); }
}
