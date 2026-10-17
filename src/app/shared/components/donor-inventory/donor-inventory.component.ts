import {Component,Input,Output,EventEmitter,OnInit,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {DonorInventoryService,DonorPart,DonorVehicle,DonorCandidate,DonorInventory} from '../../../core/services/donor-inventory.service';
import {VehicleCatalogService,VehicleCatalog} from '../../../core/services/vehicle-catalog.service';
import {OFFER_CONDITIONS,offerConditionLabel} from '../../../core/utils/offer-condition.util';
import {OfferPhoto} from '../../../core/models/app.models';
import {UiModalComponent} from '../ui-modal/ui-modal.component';
import {OfferPhotoManagerComponent} from '../offer-photo-manager/offer-photo-manager.component';
@Component({selector:'app-donor-inventory',standalone:true,imports:[CommonModule,FormsModule,UiModalComponent,OfferPhotoManagerComponent],templateUrl:'./donor-inventory.component.html',styleUrl:'./donor-inventory.component.scss'})
export class DonorInventoryComponent implements OnInit {
 @Input() storeId='';@Input() startNew=false;@Output() editOffer=new EventEmitter<string>();@Output() changed=new EventEmitter<void>();
 protected inventory=signal<DonorInventory>({vehicles:[],template:[]});protected reference=signal<VehicleCatalog>({brands:[],models:[]});
 protected loading=signal(true);protected busy=signal(false);protected error=signal('');protected notice=signal('');protected open=signal(false);protected step=signal(1);protected vehicle=signal<DonorVehicle|null>(null);protected candidates=signal<DonorCandidate[]>([]);protected photoPart=signal('');protected summary=signal('');protected deleteCandidate=signal<DonorVehicle|null>(null);
 protected readonly conditions=OFFER_CONDITIONS.filter(c=>c!=='sin_especificar').map(value=>({value,label:offerConditionLabel(value)}));
 protected readonly systems=['Motor','Transmisión','Iluminación','Carrocería','Suspensión y dirección','Frenos','Interior','Electrónica','Otros'];
 protected partSearch='';protected customName='';protected customSystem='Otros';
 constructor(private readonly service:DonorInventoryService,private readonly vehicles:VehicleCatalogService){}
 async ngOnInit(){await this.load();if(this.startNew&&!this.error())this.create();}
 protected message(error:unknown){return error instanceof HttpErrorResponse?error.error?.error?.message||'No se pudo guardar el inventario. Reintenta.':error instanceof Error?error.message:'No se pudo guardar el inventario.';}
 protected async load(){this.loading.set(true);this.error.set('');try{const [inventory,reference]=await Promise.all([this.service.list(this.storeId),this.vehicles.publicCatalog()]);this.inventory.set(inventory);this.reference.set(reference);}catch(error){this.error.set(this.message(error));}finally{this.loading.set(false);}}
 protected models(){return this.reference().models.filter(m=>m.marcaId===this.vehicle()?.marcaId);}
 protected create(){this.error.set('');this.notice.set('');this.summary.set('');this.candidates.set([]);this.photoPart.set('');this.partSearch='';this.step.set(1);this.vehicle.set({id:crypto.randomUUID(),marcaId:'',modeloId:'',anio:new Date().getFullYear(),motor:'',patente:'',vin:'',transmision:'',codigoInterno:'',estado:'en_desarme',piezas:this.inventory().template.map(p=>({...p,seleccionada:false,precio:null,stock:1,condicion:'usado',productoMaestroId:null,fotosPublicacion:[],estado:'borrador'}))});this.open.set(true);}
 protected async resume(value:DonorVehicle){this.vehicle.set(structuredClone(value));const ids=new Set(value.piezas.map(p=>p.id));this.vehicle()!.piezas.push(...this.inventory().template.filter(p=>!ids.has(p.id)).map(p=>({...p,seleccionada:false,precio:null,stock:1,condicion:'usado' as const,productoMaestroId:null,fotosPublicacion:[]})));this.step.set(2);this.summary.set('');this.photoPart.set('');this.partSearch='';this.error.set('');this.notice.set('');this.open.set(true);await this.loadCandidates();}
 protected async loadCandidates(){const vehicle=this.vehicle();if(!vehicle?.revision)return;this.busy.set(true);try{this.candidates.set((await this.service.candidates(this.storeId,vehicle.id)).items);}catch(error){this.error.set(this.message(error));}finally{this.busy.set(false);}}
 protected identityValid(){const v=this.vehicle();return !!v?.marcaId&&!!v.modeloId&&Number.isInteger(v.anio)&&v.anio>=1886&&v.anio<=new Date().getFullYear()+1;}
 protected async save(){const v=this.vehicle();if(!v||this.busy())return false;this.error.set('');this.notice.set('');if(!this.identityValid()){this.error.set('Selecciona marca, modelo y año válidos.');return false;}this.busy.set(true);try{this.vehicle.set(await this.service.save(this.storeId,v));this.notice.set('Borrador guardado. Puedes volver a abrir este vehículo después.');await this.refreshList();this.changed.emit();return true;}catch(error){this.error.set(this.message(error));return false;}finally{this.busy.set(false);}}
 private async refreshList(){this.inventory.set(await this.service.list(this.storeId));}
 protected back(){this.step.update(n=>Math.max(1,n-1));}
 protected async next(){if(await this.save()){this.step.update(n=>Math.min(3,n+1));if(this.step()===2)await this.loadCandidates();}}
 protected parts(system:string){const q=this.partSearch.trim().toLocaleLowerCase('es');return this.vehicle()?.piezas.filter(p=>p.sistema===system&&(!q||p.nombre.toLocaleLowerCase('es').includes(q)))||[];}
 protected selected(){return this.vehicle()?.piezas.filter(p=>p.seleccionada)||[];}
 protected valid(p:DonorPart){return typeof p.precio==='number'&&p.precio>0&&Number.isFinite(p.precio)&&Number.isSafeInteger(p.stock)&&Number(p.stock)>0&&p.condicion!=='sin_especificar';}
 protected ready(){return this.selected().filter(p=>!p.ofertaId&&this.valid(p)&&p.productoMaestroId).length;}
 protected pending(){return this.selected().filter(p=>!p.ofertaId&&!p.productoMaestroId).length;}
 protected incomplete(){return this.selected().filter(p=>!p.ofertaId&&!this.valid(p)).length;}
 protected photoCount(){return this.selected().reduce((sum,p)=>sum+p.fotosPublicacion.length,0);}
 protected allSelected(){return !!this.vehicle()?.piezas.length&&this.vehicle()!.piezas.every(p=>p.seleccionada);}
 protected selectAll(value:boolean){this.vehicle()?.piezas.forEach(p=>p.seleccionada=value);}
 protected suggested(part:DonorPart){return this.candidates().filter(c=>c.sugeridaPara.includes(part.id));}
 protected candidateName(id:string|null){return this.candidates().find(c=>c.id===id)?.nombre||'Pendiente de identificar';}
 protected addCustom(){const name=this.customName.trim();if(!name||!this.vehicle()||this.vehicle()!.piezas.length>=120)return;this.vehicle()!.piezas.push({id:crypto.randomUUID(),nombre:name.slice(0,120),sistema:this.customSystem,seleccionada:true,precio:null,stock:1,condicion:'usado',productoMaestroId:null,fotosPublicacion:[]});this.customName='';}
 protected async photos(part:DonorPart){if(this.photoPart()===part.id){this.photoPart.set('');return;}if(await this.save())this.photoPart.set(part.id);}
 protected vehiclePhotoPath(){return this.service.photoPath(this.storeId,this.vehicle()!.id,'vehiculo');}
 protected vehiclePhotos(photos:OfferPhoto[]){if(this.vehicle())this.vehicle()!.fotosVehiculo=photos;}
 protected async removeVehicle(){const value=this.deleteCandidate();if(!value||this.busy())return;this.busy.set(true);try{await this.service.remove(this.storeId,value.id);this.deleteCandidate.set(null);await this.refreshList();this.changed.emit();}catch(error){this.error.set(this.message(error));this.deleteCandidate.set(null);}finally{this.busy.set(false);}}
 protected photoPath(part:DonorPart){return this.service.photoPath(this.storeId,this.vehicle()!.id,part.id);}
 protected onPhotos(part:DonorPart,photos:OfferPhoto[]){const current=this.vehicle()?.piezas.find(p=>p.id===part.id);if(current)current.fotosPublicacion=photos;}
 protected async photoBusy(value:boolean){this.busy.set(value);if(!value){this.busy.set(true);try{await this.refreshList();const saved=this.inventory().vehicles.find(v=>v.id===this.vehicle()?.id);if(saved&&this.vehicle())this.vehicle()!.revision=saved.revision;}catch(error){this.error.set(this.message(error));}finally{this.busy.set(false);}}}
 protected title(v:DonorVehicle){return `${v.marcaNombre||''} ${v.modeloNombre||''} ${v.anio}${v.motor?' · Motor '+v.motor:''}`.trim();}
 protected registered(v:DonorVehicle){return v.piezas.filter(p=>p.seleccionada||p.ofertaId).length;}
 protected published(v:DonorVehicle){return v.piezas.filter(p=>p.ofertaId&&p.estado==='publicada').length;}
 protected status(value:string){return ({publicada:'Publicada',retirada:'Retirada',pendiente_revision:'En revisión',borrador:'Borrador',disponible:'Disponible',en_desarme:'En desarme',agotado:'Agotado'} as Record<string,string>)[value]||value;}
 protected edit(part:DonorPart){if(!part.ofertaId)return;this.open.set(false);this.editOffer.emit(part.ofertaId);}
 protected async publish(){if(!this.selected().length||!await this.save())return;const v=this.vehicle()!;this.busy.set(true);this.error.set('');try{const ids=this.selected().map(p=>p.id);const results:Array<{id:string;estado:string;error?:string}>=[];
   for(let offset=0;offset<ids.length;offset+=10){this.notice.set(`Publicando piezas ${offset+1}–${Math.min(offset+10,ids.length)} de ${ids.length}…`);const result=await this.service.publish(this.storeId,v.id,ids.slice(offset,offset+10));results.push(...result.results);this.vehicle.set(result.vehicle);}
   const count=(state:string)=>results.filter(r=>r.estado===state).length;this.summary.set(`${count('publicada')} publicaciones disponibles · ${count('pendiente_revision')} en revisión · ${count('borrador')} borradores · ${count('fallida')} fallidas.`);if(count('fallida'))this.error.set('Algunas piezas fallaron. Puedes reintentar sin duplicar las publicaciones.');await this.refreshList();this.changed.emit();}catch(error){this.error.set(this.message(error));try{await this.refreshList();const saved=this.inventory().vehicles.find(item=>item.id===v.id);if(saved)this.vehicle.set(structuredClone(saved));}catch{/* The existing draft remains visible if the network is unavailable. */}}finally{this.busy.set(false);}}
}
