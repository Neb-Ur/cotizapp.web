import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';
import {VehicleCatalogAdminComponent} from './vehicle-catalog-admin.component';
import {VehicleCatalogService} from '../../../core/services/vehicle-catalog.service';
async function setup(){
 const catalog:any={brands:[{id:'legacy',nombre:'Marca existente',usos:['fabricante']},{id:'vehicle',nombre:'Marca vehículo',usos:['vehiculo']}],models:[{id:'model',marcaId:'vehicle',nombre:'Modelo',activo:true}]};
 const service={adminCatalog:vi.fn(async()=>structuredClone(catalog)),enableBrand:vi.fn(async(id:string)=>{catalog.brands.find((b:any)=>b.id===id).usos.push('vehiculo');return {id,nombre:'Marca existente'};}),addBrand:vi.fn(),addModel:vi.fn(async()=>{}),updateModel:vi.fn(async()=>{})};
 await TestBed.configureTestingModule({imports:[VehicleCatalogAdminComponent],providers:[{provide:VehicleCatalogService,useValue:service}]}).compileComponents();
 const fixture=TestBed.createComponent(VehicleCatalogAdminComponent);fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
 return {fixture,component:fixture.componentInstance as any,service};
}
afterEach(()=>TestBed.resetTestingModule());
it('enables an existing brand by ID and selects it without losing manufacturer use',async()=>{
 const {fixture,component,service}=await setup();component.existingBrandId='legacy';await component.enableBrand();fixture.detectChanges();
 expect(service.enableBrand).toHaveBeenCalledWith('legacy');expect(component.selectedBrandId).toBe('legacy');
 expect(component.catalog.brands.find((b:any)=>b.id==='legacy').usos).toEqual(['fabricante','vehiculo']);
});
it('edits and deactivates a vehicle model through its ID, preserving its brand',async()=>{
 const {component,service}=await setup();component.editModel(component.models[0]);component.modelName=' Modelo actualizado ';await component.saveModel();
 expect(service.updateModel).toHaveBeenCalledWith('model',{nombre:'Modelo actualizado'});expect(service.addModel).not.toHaveBeenCalled();
 await component.toggleModel({id:'model',marcaId:'vehicle',nombre:'Modelo',activo:true});expect(service.updateModel).toHaveBeenLastCalledWith('model',{activo:false});
});
