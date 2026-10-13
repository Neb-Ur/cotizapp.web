import { Injectable } from '@angular/core';
import { ApiClientService } from './api-client.service';
export interface VehicleBrand { id:string; nombre:string; usos:Array<'fabricante'|'vehiculo'>; }
export interface VehicleModel { id:string; marcaId:string; nombre:string; activo:boolean; }
export interface VehicleCatalog { brands:VehicleBrand[]; models:VehicleModel[]; }
export interface VehicleApplication { marcaId:string; modeloId:string; anioDesde:number|null; anioHasta:number|null; marcaNombre?:string; modeloNombre?:string; }
export interface OfferVehicleApplications { applications:VehicleApplication[]; canEdit:boolean; }
@Injectable({providedIn:'root'})
export class VehicleCatalogService {
  constructor(private readonly api:ApiClientService) {}
  offerApplications(storeId:string,offerId:string):Promise<OfferVehicleApplications> { return this.api.get(`/ferreterias/${encodeURIComponent(storeId)}/catalogo/${encodeURIComponent(offerId)}/vehiculos`,true); }
  saveOfferApplications(storeId:string,offerId:string,applications:VehicleApplication[]):Promise<OfferVehicleApplications> { return this.api.put(`/ferreterias/${encodeURIComponent(storeId)}/catalogo/${encodeURIComponent(offerId)}/vehiculos`,{asociacionesVehiculos:applications},true); }
  adminCatalog():Promise<VehicleCatalog> { return this.api.get('/admin/vehiculos/catalogo',true); }
  publicCatalog():Promise<VehicleCatalog> { return this.api.get('/vehiculos/catalogo'); }
  addBrand(name:string) { return this.api.post<{id:string;nombre:string}>('/admin/vehiculos/marcas',{nombre:name},true); }
  enableBrand(id:string) { return this.api.post<{id:string;nombre:string}>('/admin/vehiculos/marcas',{marcaId:id},true); }
  addModel(brandId:string,name:string) { return this.api.post('/admin/vehiculos/modelos',{marcaId:brandId,nombre:name},true); }
  updateModel(id:string,patch:{nombre?:string;activo?:boolean}) { return this.api.patch(`/admin/vehiculos/modelos/${encodeURIComponent(id)}`,patch,true); }
}
