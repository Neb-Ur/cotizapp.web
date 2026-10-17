import {TestBed,ComponentFixture} from '@angular/core/testing';
import {vi} from 'vitest';
import {DonorInventoryComponent} from './donor-inventory.component';
import {DonorInventoryService} from '../../../core/services/donor-inventory.service';
import {VehicleCatalogService} from '../../../core/services/vehicle-catalog.service';
describe('vehicle donor inventory wizard',()=>{
 let fixture:ComponentFixture<DonorInventoryComponent>,component:any,service:any,stored:any;
 beforeEach(async()=>{
  stored=null;
  service={list:vi.fn(async()=>({vehicles:stored?[structuredClone(stored)]:[],template:[{id:'radiator',nombre:'Radiador',sistema:'Motor'},{id:'light',nombre:'Foco delantero izquierdo',sistema:'Iluminación'}]})),save:vi.fn(async(_store:string,value:any)=>{stored={...structuredClone(value),revision:(value.revision||0)+1,marcaNombre:'Mahindra',modeloNombre:'KUV100'};return stored;}),candidates:vi.fn(async()=>({items:[{id:'master',nombre:'Radiador Mahindra KUV100 2016–2019',sugeridaPara:['radiator']}]})),publish:vi.fn(async()=>({vehicle:stored,results:[{id:'radiator',estado:'publicada'},{id:'light',estado:'borrador'}]})),photoPath:vi.fn(()=>'/photos'),remove:vi.fn(async()=>{})};
  await TestBed.configureTestingModule({imports:[DonorInventoryComponent],providers:[{provide:DonorInventoryService,useValue:service},{provide:VehicleCatalogService,useValue:{publicCatalog:vi.fn(async()=>({brands:[{id:'mahindra',nombre:'Mahindra'}],models:[{id:'kuv',marcaId:'mahindra',nombre:'KUV100'}]}))}}]}).compileComponents();
  fixture=TestBed.createComponent(DonorInventoryComponent);component=fixture.componentInstance;component.storeId='junk';fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
 });
 afterEach(()=>fixture.destroy());
 it('starts with no parts selected, validates identity and saves progress before moving to candidate selection',async()=>{
  component.create();expect(component.selected()).toHaveLength(0);await component.next();expect(service.save).not.toHaveBeenCalled();expect(component.step()).toBe(1);
  Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();expect(component.step()).toBe(2);expect(service.candidates).toHaveBeenCalledWith('junk',component.vehicle().id);expect(component.vehicle().piezas.every((p:any)=>p.stock===1&&p.condicion==='usado')).toBe(true);expect(component.vehicle().piezas.every((p:any)=>!p.productoMaestroId)).toBe(true);
 });
 it('keeps complete, unidentified and incomplete pieces distinct and retries publish without resetting the vehicle ID',async()=>{
  component.create();const originalId=component.vehicle().id;Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();const [a,b]=component.vehicle().piezas;Object.assign(a,{seleccionada:true,precio:35000,productoMaestroId:'master'});Object.assign(b,{seleccionada:true,precio:null});expect(component.ready()).toBe(1);expect(component.incomplete()).toBe(1);expect(component.pending()).toBe(1);await component.next();expect(component.step()).toBe(3);
  service.publish.mockRejectedValueOnce(new Error('Respuesta perdida'));await component.publish();expect(component.error()).toContain('Respuesta perdida');expect(component.vehicle().id).toBe(originalId);expect(component.selected()).toHaveLength(2);await component.publish();expect(service.publish).toHaveBeenLastCalledWith('junk',originalId,['radiator','light']);expect(component.summary()).toContain('1 publicaciones');
 });
 it('resumes a saved vehicle, keeps its IDs and opens the exact individual offer for later edits',async()=>{
  const saved={id:'vehicle-a',marcaId:'mahindra',modeloId:'kuv',anio:2018,motor:'1.2',revision:3,piezas:[{id:'radiator',nombre:'Radiador',sistema:'Motor',seleccionada:true,precio:30000,stock:1,condicion:'usado',productoMaestroId:'master',ofertaId:'specific-offer',fotosPublicacion:[]}]};await component.resume(saved);expect(component.vehicle().id).toBe('vehicle-a');expect(component.vehicle().piezas).toHaveLength(2);expect(component.vehicle().piezas[1].seleccionada).toBe(false);const emitted=vi.fn();component.editOffer.subscribe(emitted);component.edit(component.vehicle().piezas[0]);expect(emitted).toHaveBeenCalledWith('specific-offer');expect(component.open()).toBe(false);
 });
});
