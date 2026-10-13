import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';
import {OfferVehicleApplicationsComponent} from './offer-vehicle-applications.component';
import {VehicleCatalogService} from '../../../core/services/vehicle-catalog.service';
const first={marcaId:'a',modeloId:'model-a',anioDesde:2000,anioHasta:2004,marcaNombre:'Marca A',modeloNombre:'Modelo A'};
async function setup(canEdit=true){
 const service={offerApplications:vi.fn(async()=>({applications:[structuredClone(first)],canEdit})),publicCatalog:vi.fn(async()=>({brands:[{id:'a',nombre:'Marca A',usos:['vehiculo']}],models:[{id:'model-a',marcaId:'a',nombre:'Modelo A',activo:true}]})),saveOfferApplications:vi.fn(async(_store:string,_offer:string,applications:any[])=>({applications,canEdit:true}))};
 await TestBed.configureTestingModule({imports:[OfferVehicleApplicationsComponent],providers:[{provide:VehicleCatalogService,useValue:service}]}).compileComponents();
 const fixture=TestBed.createComponent(OfferVehicleApplicationsComponent);fixture.componentRef.setInput('storeId','store');fixture.componentRef.setInput('offerId','offer');fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
 return {fixture,component:fixture.componentInstance as any,service};
}
afterEach(()=>TestBed.resetTestingModule());
it('keeps complete declarations and turns a single declared year into an explicit one-year interval',async()=>{
 const {component,service}=await setup();component.add();Object.assign(component.applications[1],{marcaId:'a',modeloId:'model-a',anioDesde:2008});await component.save();
 expect(service.saveOfferApplications).toHaveBeenCalledWith('store','offer',[first,{marcaId:'a',modeloId:'model-a',anioDesde:2008,anioHasta:2008}]);
 expect(component.notice).toContain('guardadas');
});
it('retains the draft after a rejected save and always releases the parent modal',async()=>{
 const {component,service}=await setup();const busy=vi.fn();component.busyChange.subscribe(busy);service.saveOfferApplications.mockRejectedValueOnce(new Error('Años inválidos'));await component.save();
 expect(component.applications).toEqual([first]);expect(component.error).toBe('Años inválidos');expect(component.saving).toBe(false);expect(busy.mock.calls).toEqual([[true],[false]]);
});
it('keeps declarations readable when writes are disabled and does not load editing references',async()=>{
 const {fixture,component,service}=await setup(false);expect(service.publicCatalog).not.toHaveBeenCalled();expect(fixture.nativeElement.textContent).toContain('Marca A');expect(fixture.nativeElement.querySelector('select')).toBeNull();await component.save();expect(service.saveOfferApplications).not.toHaveBeenCalled();
});
