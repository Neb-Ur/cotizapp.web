import {HttpErrorResponse} from '@angular/common/http';
import {TestBed,ComponentFixture} from '@angular/core/testing';
import {vi} from 'vitest';
import {DonorInventoryComponent} from './donor-inventory.component';
import {DonorInventoryService} from '../../../core/services/donor-inventory.service';
import {VehicleCatalogService} from '../../../core/services/vehicle-catalog.service';
describe('vehicle donor inventory wizard',()=>{
 let fixture:ComponentFixture<DonorInventoryComponent>,component:any,service:any,stored:any;
 beforeEach(async()=>{
  stored=null;
  service={list:vi.fn(async()=>({vehicles:stored?[structuredClone(stored)]:[],template:[{id:'radiator',nombre:'Radiador',sistema:'Motor'},{id:'light',nombre:'Foco delantero izquierdo',sistema:'Iluminación'}]})),save:vi.fn(async(_store:string,value:any)=>{stored={...structuredClone(value),revision:(value.revision||0)+1,marcaNombre:'Mahindra',modeloNombre:'KUV100'};return structuredClone(stored);}),candidates:vi.fn(async()=>({items:[{id:'master',nombre:'Radiador Mahindra KUV100 2016–2019',sugeridaPara:['radiator']}]})),publish:vi.fn(async()=>({vehicle:stored,results:[{id:'radiator',estado:'publicada'},{id:'light',estado:'borrador'}]})),photoPath:vi.fn(()=>'/photos'),remove:vi.fn(async()=>{})};
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
  service.publish.mockRejectedValueOnce(new Error('Respuesta perdida'));await component.publish();expect(component.error()).toContain('Respuesta perdida');expect(component.vehicle().id).toBe(originalId);expect(component.selected()).toHaveLength(2);await component.publish();expect(service.publish).toHaveBeenLastCalledWith('junk',originalId,['radiator']);expect(component.summary()).toContain('1 publicaciones');
 });
 it('resumes a saved vehicle, keeps its IDs and opens the exact individual offer for later edits',async()=>{
  const saved={id:'vehicle-a',marcaId:'mahindra',modeloId:'kuv',anio:2018,motor:'1.2',revision:3,piezas:[{id:'radiator',nombre:'Radiador',sistema:'Motor',seleccionada:true,precio:30000,stock:1,condicion:'usado',productoMaestroId:'master',ofertaId:'specific-offer',fotosPublicacion:[]}]};await component.resume(saved);expect(component.vehicle().id).toBe('vehicle-a');expect(component.vehicle().piezas).toHaveLength(2);expect(component.vehicle().piezas[1].seleccionada).toBe(false);const emitted=vi.fn();component.editOffer.subscribe(emitted);await component.edit(component.vehicle().piezas[0]);expect(emitted).toHaveBeenCalledWith('specific-offer');expect(component.open()).toBe(false);
 });
 it('preserves edits made while a save is in flight and serializes the next revision',async()=>{
  component.create();Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();
  let release:(value:any)=>void=()=>{};
  service.save.mockImplementationOnce((_store:string,value:any)=>new Promise(resolve=>{release=()=>resolve({...structuredClone(value),revision:2});}));
  const piece=component.vehicle().piezas[0];piece.seleccionada=true;piece.precio=20000;component.draftChanged();
  const first=component.save();piece.precio=25000;component.draftChanged();release(null);await first;
  expect(service.save.mock.calls.at(-1)[1].piezas[0].precio).toBe(25000);
  expect(service.save.mock.calls.at(-1)[1].revision).toBe(2);
  expect(component.vehicle().piezas[0].precio).toBe(25000);expect(component.saveState()).toBe('saved');
 });
 it('saves before closing, resumes the last step and leaves a failed save open for retry',async()=>{
  component.create();Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();
  component.vehicle().piezas[0].seleccionada=true;component.draftChanged();await component.next();
  expect(stored.pasoActual).toBe(3);await component.close();expect(component.open()).toBe(false);
  await component.resume(stored);expect(component.step()).toBe(3);
  component.vehicle().piezas[0].precio=12000;component.draftChanged();service.save.mockRejectedValueOnce(new Error('Sin conexión'));
  await component.close();expect(component.open()).toBe(true);expect(component.saveState()).toBe('error');
  await component.close();expect(component.open()).toBe(false);expect(stored.piezas[0].precio).toBe(12000);
 });
 it('formats CLP input and selects only the filtered visible pieces',()=>{
  component.create();component.activeSystem='Iluminación';component.selectAll(true);
  expect(component.selected().map((part:any)=>part.id)).toEqual(['light']);
  const input={value:'$ 28.000'};component.setPrice(component.vehicle().piezas[1],{target:input});
  expect(component.vehicle().piezas[1].precio).toBe(28000);expect(input.value).toBe('28.000');
  expect(component.ready()).toBe(1);
 });

 it('persists a step change made during an earlier autosave',async()=>{
  component.create();Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();
  let release:(value:any)=>void=()=>{};service.save.mockImplementationOnce((_store:string,value:any)=>new Promise(resolve=>{release=()=>resolve({...structuredClone(value),revision:2});}));
  component.draftChanged();const saving=component.save();const switching=component.goToStep(3);release(null);await Promise.all([saving,switching]);
  expect(component.step()).toBe(3);expect(component.vehicle().pasoActual).toBe(3);expect(stored.pasoActual).toBe(3);
 });
 it('saves other draft pieces before opening an existing publication',async()=>{
  component.create();Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();
  component.vehicle().piezas[0].ofertaId='published';component.vehicle().piezas[1].seleccionada=true;component.vehicle().piezas[1].precio=30000;component.draftChanged();
  const emitted=vi.fn();component.editOffer.subscribe(emitted);service.save.mockRejectedValueOnce(new Error('Sin conexión'));
  await component.edit(component.vehicle().piezas[0]);expect(component.open()).toBe(true);expect(emitted).not.toHaveBeenCalled();
  await component.edit(component.vehicle().piezas[0]);expect(stored.piezas[1].precio).toBe(30000);expect(emitted).toHaveBeenCalledWith('published');
 });

 it('offers an explicit recovery from a revision conflict without silently replacing edits',async()=>{
  component.create();Object.assign(component.vehicle(),{marcaId:'mahindra',modeloId:'kuv',anio:2018});await component.next();
  component.vehicle().piezas[0].precio=28000;component.draftChanged();service.save.mockRejectedValueOnce(new HttpErrorResponse({status:409,error:{error:{message:'El inventario cambió en otra pestaña.'}}}));
  await component.save();expect(component.conflict()).toBe(true);expect(component.vehicle().piezas[0].precio).toBe(28000);
  await component.reopenSaved();expect(component.conflict()).toBe(false);expect(component.vehicle().piezas[0].precio).toBeNull();expect(component.saveState()).toBe('saved');
 });

});
