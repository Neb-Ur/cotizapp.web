import {Component,EventEmitter,Input,Output,OnInit,signal} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {ApiClientService} from '../../../core/services/api-client.service';
import {OfferPhoto} from '../../../core/models/app.models';
@Component({selector:'app-offer-photo-manager',standalone:true,template:`
 <section aria-label="Fotos de esta publicación" class="offer-photos">
  <h3>{{heading}}</h3>
  <p>{{description}}</p>
  <div class="photo-grid">
   @for(photo of photos;track photo.id){
    <figure><img [src]="photo.thumbnailUrl" alt="Foto de la pieza publicada por tu local" width="160" height="120" loading="lazy" />
     <button type="button" (click)="remove(photo)" [disabled]="disabled || busy()" aria-label="Eliminar foto">Eliminar foto</button></figure>
   }
  </div>
  @if(enabled()){
   <label>Agregar fotos<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" [disabled]="disabled || busy() || photos.length >= 12" (change)="upload($event)" /></label>
   <small>{{photos.length}} de 12 fotos · JPG, PNG, WebP o AVIF · hasta 8 MB por foto.</small>
  }@else{<p>{{configMessage()}}</p>}
  @if(busy()){<p role="status">{{progress()}}</p>}
  @if(error()){<p role="alert" class="photo-error">{{error()}}</p>}
 </section>`,styles:`
 :host{display:block}.offer-photos{border:1px solid #d7dfe6;border-radius:12px;padding:16px;margin:16px 0;background:#f6f8fa;color:#0f2d4a}
 h3{margin:0 0 8px;font-size:1rem}p,small{font-size:.85rem;line-height:1.5}label{display:grid;gap:8px;font-weight:600}input{max-width:100%;font:inherit;font-size:.85rem}
 .photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;margin:12px 0}figure{margin:0;min-width:0}img{width:100%;height:100px;object-fit:contain;background:#fff;border-radius:8px}button{width:100%;min-height:40px;border:1px solid #cbd5df;background:white;border-radius:8px;color:#9f251f;cursor:pointer}button:disabled{opacity:.5;cursor:default}.photo-error{color:#a32222}
 `})
export class OfferPhotoManagerComponent implements OnInit {
 @Input() heading='Fotos de esta publicación';@Input() description='Sube fotos propias de la pieza. Los clientes las verán con el nombre de tu local. Se guardan al subirlas.';@Input() endpoint='';@Input() storeId='';@Input() offerId='';@Input() photos:OfferPhoto[]=[];@Input() disabled=false;
 @Output() photosChange=new EventEmitter<OfferPhoto[]>();@Output() busyChange=new EventEmitter<boolean>();
 protected enabled=signal(false);protected busy=signal(false);protected error=signal('');protected progress=signal('');protected configMessage=signal('Comprobando carga de fotos…');
 constructor(private readonly api:ApiClientService){}
 async ngOnInit(){try{const config=await this.api.get<{imageStorage?:{enabled:boolean}}>('/config');this.enabled.set(config.imageStorage?.enabled===true);this.configMessage.set('La carga de fotos no está disponible en este momento.');}catch{this.configMessage.set('No pudimos comprobar la carga de fotos. Vuelve a abrir el producto para reintentar.');}}
 private path(){return this.endpoint || `/ferreterias/${encodeURIComponent(this.storeId)}/catalogo/${encodeURIComponent(this.offerId)}/fotos`;}
 private setBusy(value:boolean){this.busy.set(value);this.busyChange.emit(value);}
 private message(error:unknown){return error instanceof HttpErrorResponse?error.error?.error?.message||'No se pudo guardar la foto. Intenta nuevamente.':error instanceof Error?error.message:'No se pudo guardar la foto.';}
 protected async upload(event:Event){
  const input=event.target as HTMLInputElement,files=Array.from(input.files||[]);
  if(!files.length||this.busy()||this.disabled||!this.enabled()||!this.storeId||!this.offerId)return;
  this.error.set('');
  if(files.length+this.photos.length>12){this.error.set('Puedes subir hasta 12 fotos por publicación.');input.value='';return;}
  if(files.some(f=>!['image/jpeg','image/png','image/webp','image/avif'].includes(f.type)||!f.size||f.size>8*1024*1024)){this.error.set('Selecciona imágenes JPG, PNG, WebP o AVIF de hasta 8 MB cada una.');input.value='';return;}
  this.setBusy(true);
  try{for(const [i,file] of files.entries()){this.progress.set(`Subiendo foto ${i+1} de ${files.length}…`);const result=await this.api.uploadImage<{photos:OfferPhoto[]}>(this.path(),file);this.photos=result.photos;this.photosChange.emit(this.photos);}}
  catch(error){this.error.set(this.message(error));}
  finally{this.setBusy(false);input.value='';}
 }
 protected async remove(photo:OfferPhoto){
  if(this.busy()||this.disabled)return;this.error.set('');this.progress.set('Eliminando foto…');this.setBusy(true);
  try{const result=await this.api.delete<{photos:OfferPhoto[]}>(this.path()+'/'+encodeURIComponent(photo.id),true);this.photos=result.photos;this.photosChange.emit(this.photos);}
  catch(error){this.error.set(this.message(error));}finally{this.setBusy(false);}
 }
}
