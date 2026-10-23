import {Component,Input,Output,EventEmitter,OnInit,OnDestroy,HostListener,signal,effect} from '@angular/core';
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
export class DonorInventoryComponent implements OnInit, OnDestroy {
 @Input() storeId='';@Input() startNew=false;@Output() editOffer=new EventEmitter<string>();@Output() changed=new EventEmitter<void>();@Output() editingChange=new EventEmitter<boolean>();
 protected inventory=signal<DonorInventory>({vehicles:[],template:[]});protected reference=signal<VehicleCatalog>({brands:[],models:[]});
 protected loading=signal(true);protected busy=signal(false);protected error=signal('');protected notice=signal('');protected open=signal(false);protected step=signal(1);protected vehicle=signal<DonorVehicle|null>(null);protected candidates=signal<DonorCandidate[]>([]);protected photoPart=signal('');protected summary=signal('');protected deleteCandidate=signal<DonorVehicle|null>(null);
 protected readonly conditions=OFFER_CONDITIONS.filter(c=>c!=='sin_especificar').map(value=>({value,label:offerConditionLabel(value)}));
 protected readonly systems=['Motor','Transmisión','Iluminación','Carrocería','Suspensión y dirección','Frenos','Interior','Electrónica','Otros'];
 protected conflict=signal(false);
 protected saveState=signal<'saved'|'dirty'|'saving'|'error'>('saved');
 protected activeSystem='Todos';protected detailPart=signal('');
 private autoSaveTimer?:ReturnType<typeof setTimeout>;private saveTask?:Promise<boolean>;private editVersion=0;private destroyed=false;
 ngOnDestroy(){this.destroyed=true;clearTimeout(this.autoSaveTimer);}
 @HostListener('window:beforeunload',['$event']) warnUnsaved(event:BeforeUnloadEvent){if(this.open()&&this.saveState()!=='saved'){event.preventDefault();event.returnValue='';}}
 protected draftChanged(){this.editVersion++;this.saveState.set('dirty');clearTimeout(this.autoSaveTimer);if(this.vehicle()?.revision)this.autoSaveTimer=setTimeout(()=>{void this.save();},800);}
 public async prepareToLeave():Promise<boolean>{if(!this.open() || this.saveState()==='saved')return true;return this.identityValid()?this.save():true;}
 protected async close(){if(this.busy())return;if(this.saveState()!=='saved' && this.identityValid() && !await this.save())return;this.open.set(false);}
 private changingStep=false;
 protected async goToStep(target:number){
  if(target===this.step()||this.busy()||this.changingStep)return;
  if(target>1&&!this.identityValid()){this.error.set('Selecciona marca, modelo y año válidos.');return;}
  this.changingStep=true;
  try{
   const previous=this.vehicle()!.pasoActual;
   this.vehicle()!.pasoActual=target;this.editVersion++;this.saveState.set('dirty');
   if(!await this.save()){this.vehicle()!.pasoActual=previous;return;}
   this.step.set(target);if(target===2)await this.loadCandidates();
  }finally{this.changingStep=false;}
 }
 protected formatPrice(value:number|null){return value===null?'':new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(value);}
 protected setPrice(part:DonorPart,event:Event){const input=event.target as HTMLInputElement;const digits=input.value.replace(/[^0-9]/g,'');const number=digits?Number(digits):null;part.precio=number!==null&&Number.isSafeInteger(number)?number:null;input.value=this.formatPrice(part.precio);this.draftChanged();}
 protected nextPrice(event:Event){event.preventDefault();const input=event.target as HTMLElement;const inputs=Array.from(input.closest('.price-list')?.querySelectorAll<HTMLInputElement>('.price-input')||[]);const next=inputs[inputs.indexOf(input as HTMLInputElement)+1];next?.focus();next?.select();}
 protected previewName(part:DonorPart){return `${part.nombre} ${this.title(this.vehicle()!)}`;}
 protected resumeStep(v:DonorVehicle){return v.pasoActual || (v.piezas.some(p=>p.seleccionada)?3:2);}
 protected hasOffers(v:DonorVehicle){return v.piezas.some(p=>!!p.ofertaId);}
 protected priced(v:DonorVehicle){return v.piezas.filter(p=>p.seleccionada&&this.valid(p)&&!p.ofertaId).length;}
 protected partSearch='';protected customName='';protected customSystem='Otros';
 constructor(private readonly service:DonorInventoryService,private readonly vehicles:VehicleCatalogService){effect(()=>this.editingChange.emit(this.open()));}
 async ngOnInit(){await this.load();if(this.startNew&&!this.error())this.create();}
 protected message(error:unknown){return error instanceof HttpErrorResponse?error.error?.error?.message||'No se pudo guardar el inventario. Reintenta.':error instanceof Error?error.message:'No se pudo guardar el inventario.';}
 protected async load(){this.loading.set(true);this.error.set('');try{const [inventory,reference]=await Promise.all([this.service.list(this.storeId),this.vehicles.publicCatalog()]);this.inventory.set(inventory);this.reference.set(reference);}catch(error){this.error.set(this.message(error));}finally{this.loading.set(false);}}
 protected models(){return this.reference().models.filter(m=>m.marcaId===this.vehicle()?.marcaId);}
 protected create(){this.error.set('');this.notice.set('');this.summary.set('');this.candidates.set([]);this.photoPart.set('');this.partSearch='';this.conflict.set(false);this.saveState.set('saved');this.activeSystem='Todos';this.detailPart.set('');this.step.set(1);this.vehicle.set({id:crypto.randomUUID(),marcaId:'',modeloId:'',anio:new Date().getFullYear(),motor:'',patente:'',vin:'',transmision:'',codigoInterno:'',estado:'en_desarme',piezas:this.inventory().template.map(p=>({...p,seleccionada:false,precio:null,stock:1,condicion:'usado',productoMaestroId:null,fotosPublicacion:[],estado:'borrador'}))});this.open.set(true);}
 protected async resume(value:DonorVehicle){this.vehicle.set(structuredClone(value));const ids=new Set(value.piezas.map(p=>p.id));this.vehicle()!.piezas.push(...this.inventory().template.filter(p=>!ids.has(p.id)).map(p=>({...p,seleccionada:false,precio:null,stock:1,condicion:'usado' as const,productoMaestroId:null,fotosPublicacion:[]})));this.conflict.set(false);this.saveState.set('saved');this.activeSystem='Todos';this.detailPart.set('');this.step.set(this.resumeStep(value));this.summary.set('');this.photoPart.set('');this.partSearch='';this.error.set('');this.notice.set('');this.open.set(true);await this.loadCandidates();}
 protected async loadCandidates(){const vehicle=this.vehicle();if(!vehicle?.revision)return;this.busy.set(true);try{this.candidates.set((await this.service.candidates(this.storeId,vehicle.id)).items);}catch(error){this.error.set(this.message(error));}finally{this.busy.set(false);}}
 protected identityValid(){const v=this.vehicle();return !!v?.marcaId&&!!v.modeloId&&Number.isInteger(v.anio)&&v.anio>=1886&&v.anio<=new Date().getFullYear()+1;}
 protected async save():Promise<boolean>{
  clearTimeout(this.autoSaveTimer);
  if(this.saveTask)return this.saveTask;
  const v=this.vehicle();if(!v||this.busy())return false;
  this.error.set('');this.notice.set('');
  if(!this.identityValid()){this.error.set('Selecciona marca, modelo y año válidos.');return false;}
  this.saveTask=this.persistVehicle();
  try{return await this.saveTask;}finally{this.saveTask=undefined;}
 }
 private async persistVehicle():Promise<boolean>{
  this.saveState.set('saving');
  try{
   do{
    const v=this.vehicle()!,version=this.editVersion;
    const saved=await this.service.save(this.storeId,structuredClone(v));
    if(this.destroyed)return true;
    if(version===this.editVersion)this.vehicle.set(saved);
    else Object.assign(this.vehicle()!,{revision:saved.revision,marcaNombre:saved.marcaNombre,modeloNombre:saved.modeloNombre});
    this.inventory.update(current=>({...current,vehicles:[saved,...current.vehicles.filter(row=>row.id!==saved.id)]}));
    if(version===this.editVersion){this.saveState.set('saved');break;}
   }while(!this.destroyed);
   return true;
  }catch(error){this.error.set(this.message(error));this.saveState.set('error');this.conflict.set(error instanceof HttpErrorResponse && error.status===409);return false;}
 }
 protected async reopenSaved(){const id=this.vehicle()?.id;if(!id)return;this.busy.set(true);try{await this.refreshList();const saved=this.inventory().vehicles.find(v=>v.id===id);if(saved)await this.resume(saved);else this.error.set('El vehículo ya no está disponible.');}catch(error){this.error.set(this.message(error));}finally{this.busy.set(false);}}
 private async refreshList(){this.inventory.set(await this.service.list(this.storeId));}
 protected back(){void this.goToStep(Math.max(1,this.step()-1));}
 protected async next(){await this.goToStep(Math.min(3,this.step()+1));}
 protected parts(system:string){const q=this.partSearch.trim().toLocaleLowerCase('es');return this.vehicle()?.piezas.filter(p=>p.sistema===system&&(this.activeSystem==='Todos'||p.sistema===this.activeSystem)&&(!q||p.nombre.toLocaleLowerCase('es').includes(q)))||[];}
 protected selected(){return this.vehicle()?.piezas.filter(p=>p.seleccionada)||[];}
 protected valid(p:DonorPart){return typeof p.precio==='number'&&p.precio>0&&Number.isFinite(p.precio)&&Number.isSafeInteger(p.stock)&&Number(p.stock)>0&&p.condicion!=='sin_especificar';}
 protected ready(){return this.selected().filter(p=>!p.ofertaId&&this.valid(p)).length;}
 protected pending(){return this.selected().filter(p=>!p.ofertaId&&!p.productoMaestroId).length;}
 protected incomplete(){return this.selected().filter(p=>!p.ofertaId&&!this.valid(p)).length;}
 protected photoCount(){return this.selected().reduce((sum,p)=>sum+p.fotosPublicacion.length,0);}
 protected allSelected(){const visible=this.systems.flatMap(system=>this.parts(system)).filter(p=>!p.ofertaId);return visible.length>0&&visible.every(p=>p.seleccionada);}
 protected selectAll(value:boolean){for(const system of this.systems)for(const p of this.parts(system))if(!p.ofertaId)p.seleccionada=value;this.draftChanged();}
 protected suggested(part:DonorPart){return this.candidates().filter(c=>c.sugeridaPara.includes(part.id));}
 protected candidateName(id:string|null){return this.candidates().find(c=>c.id===id)?.nombre||'Pendiente de identificar';}
 protected addCustom(){const name=this.customName.trim();if(!name||!this.vehicle()||this.vehicle()!.piezas.length>=120)return;this.vehicle()!.piezas.push({id:crypto.randomUUID(),nombre:name.slice(0,120),sistema:this.customSystem,seleccionada:true,precio:null,stock:1,condicion:'usado',productoMaestroId:null,fotosPublicacion:[]});this.customName='';this.draftChanged();}
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
 protected async edit(part:DonorPart){if(!part.ofertaId||!await this.prepareToLeave())return;this.open.set(false);this.editOffer.emit(part.ofertaId);}
 protected async publish(){if(!this.ready()||!await this.save())return;const v=this.vehicle()!;this.busy.set(true);this.error.set('');try{const ids=this.selected().filter(p=>!p.ofertaId&&this.valid(p)).map(p=>p.id);if(!ids.length)return;const results:Array<{id:string;estado:string;error?:string}>=[];
   for(let offset=0;offset<ids.length;offset+=10){this.notice.set(`Publicando piezas ${offset+1}–${Math.min(offset+10,ids.length)} de ${ids.length}…`);const result=await this.service.publish(this.storeId,v.id,ids.slice(offset,offset+10));results.push(...result.results);this.vehicle.set(result.vehicle);}
   const count=(state:string)=>results.filter(r=>r.estado===state).length;this.summary.set(`${count('publicada')} publicaciones disponibles · ${count('pendiente_revision')} en revisión · ${count('borrador')} borradores · ${count('fallida')} fallidas.`);if(count('fallida'))this.error.set('Algunas piezas fallaron. Puedes reintentar sin duplicar las publicaciones.');await this.refreshList();this.changed.emit();}catch(error){this.error.set(this.message(error));try{await this.refreshList();const saved=this.inventory().vehicles.find(item=>item.id===v.id);if(saved)this.vehicle.set(structuredClone(saved));}catch{/* The existing draft remains visible if the network is unavailable. */}}finally{this.busy.set(false);}}
}
