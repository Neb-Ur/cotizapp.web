import {apiErrorMessage} from '../../../core/utils/api-error.util';
import {Component,Input,Output,EventEmitter,OnChanges,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ApiClientService} from '../../../core/services/api-client.service';
import {normalizeProfessionalTools,normalizeContact,type ProfessionalTools,type ClientContact} from '../../../../../functions/src/domain/professional-tools';
import {WorkBudget} from '../../../core/utils/work-budget.util';
@Component({selector:'app-professional-tools',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./professional-tools.component.html',styleUrl:'./professional-tools.component.scss'})
export class ProfessionalToolsComponent implements OnChanges {
 @Input({required:true}) ownerId='';
 @Input() budget?:WorkBudget;
 @Output() changed=new EventEmitter<void>();
 protected tools:ProfessionalTools=normalizeProfessionalTools(null);
 protected contact:ClientContact={id:'',name:'',phone:'',email:'',address:''};
 protected selected='';protected search='';protected busy=false;protected loaded=false;protected notice='';protected error='';
 constructor(private api:ApiClientService,private cdr:ChangeDetectorRef){}
 ngOnChanges(changes:any){if(changes.ownerId && this.ownerId)this.load();}
 protected get matches(){const q=this.search.toLocaleLowerCase();return this.tools.clients.filter(c=>[c.name,c.phone,c.email,c.address].join(' ').toLocaleLowerCase().includes(q));}
 protected async load(){this.loaded=false;this.error='';try{this.tools=await this.api.get<ProfessionalTools>(`/maestros/${this.ownerId}/herramientas`,true);this.loaded=true;}catch{this.error='No se pudo cargar la agenda. Vuelve a intentar.';}finally{this.cdr.markForCheck();}}
 protected edit(c:ClientContact){this.contact=structuredClone(c);this.selected=c.id;}
 protected newContact(){this.contact={id:'',name:'',phone:'',email:'',address:''};this.selected='';}
 private async persist(next:ProfessionalTools){this.busy=true;this.error='';this.notice='';try{this.tools=await this.api.put<ProfessionalTools>(`/maestros/${this.ownerId}/herramientas`,next,true);this.notice='Datos guardados en tu cuenta.';return true;}catch(e){this.error=apiErrorMessage(e,'No se pudieron guardar los datos.');return false;}finally{this.busy=false;this.cdr.markForCheck();}}
 protected async saveProfile(){try{await this.persist(normalizeProfessionalTools(this.tools));}catch(e){this.error=(e as Error).message;}}
 protected async saveContact(){try{const c=normalizeContact({...this.contact,id:this.contact.id||crypto.randomUUID()});const next=structuredClone(this.tools);const i=next.clients.findIndex(x=>x.id===c.id);if(i<0)next.clients.push(c);else next.clients[i]=c;if(await this.persist(normalizeProfessionalTools(next)))this.edit(c);}catch(e){this.error=(e as Error).message;}}
 protected async removeContact(c:ClientContact){const next=structuredClone(this.tools);next.clients=next.clients.filter(x=>x.id!==c.id);if(await this.persist(next))this.newContact();}
 protected applyClient(c:ClientContact){if(!this.budget)return;this.budget.client=structuredClone(c);this.budget.clientName=c.name;this.changed.emit();this.notice='Cliente aplicado a esta cotización. Guarda la cotización para conservarlo.';}
 protected applyProfile(){if(!this.budget)return;this.budget.professional=structuredClone(this.tools.profile);if(!this.budget.terms)this.budget.terms=this.tools.profile.defaultTerms;this.changed.emit();this.notice='Datos profesionales y condiciones aplicados. Guarda la cotización para conservarlos.';}
 protected async upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;this.error='';try{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5_000_000)throw new Error('Usa una imagen JPEG, PNG o WebP de hasta 5 MB.');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const data=canvas.toDataURL('image/jpeg',.8);if(data.length>140000)throw new Error('El logo tiene demasiado detalle. Usa una imagen más sencilla.');this.tools.profile.logo={data,width:canvas.width,height:canvas.height};
 }catch(e){this.error=(e as Error).message;}finally{this.cdr.markForCheck();}}
}
