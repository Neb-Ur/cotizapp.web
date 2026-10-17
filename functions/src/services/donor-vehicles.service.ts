import {db} from '../lib/firebase.js';
import {COLLECTIONS} from '../lib/collections.js';
import {DonorError,donorStore,donorOfferId,donorRequestId,text,validateDonorIdentity,normalizeDonorParts,validDonorPrice,matchesDonor} from '../domain/donor-vehicle.js';
import {productMatchesBusinessType} from '../domain/business-type.js';
import {publicOfferPhotos,type OfferPhoto,MAX_OFFER_PHOTOS} from '../domain/offer-photo.js';
import {uploadProductImage,deleteOfferImageFiles,ImageStorageError} from './image-storage.service.js';
import {createHash,randomUUID} from 'node:crypto';
export function donorView(value:any){return {...value,fotosVehiculo:publicOfferPhotos(value.fotosVehiculo),piezas:(value.piezas||[]).map((p:any)=>({...p,fotosPublicacion:publicOfferPhotos(p.fotosPublicacion)}))};}
export async function saveDonor(storeId:string,id:string,input:any,actorId:string,admin:boolean){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new DonorError('DONOR_ID_INVALID','Identificador de vehículo inválido.');
 validateDonorIdentity(input);
 return db.runTransaction(async tx=>{
  const ref=db.collection(COLLECTIONS.donorVehicles).doc(id),storeRef=db.collection(COLLECTIONS.stores).doc(storeId);
  const [before,store,brand,model]=await Promise.all([tx.get(ref),tx.get(storeRef),tx.get(db.collection(COLLECTIONS.brands).doc(input.marcaId)),tx.get(db.collection(COLLECTIONS.vehicleModels).doc(input.modeloId))]);
  if(!store.exists||!donorStore(store.data())||(!admin&&store.data()?.['usuarioDuenoId']!==actorId))throw new DonorError('AUTH_FORBIDDEN','Este inventario solo está disponible para la desarmaduría propietaria.',403);
  const previous=before.data();
  if(previous&&previous['ferreteriaId']!==storeId)throw new DonorError('AUTH_FORBIDDEN','No puedes modificar este vehículo.',403);
  if(!brand.exists||!model.exists||model.data()?.['marcaId']!==input.marcaId||model.data()?.['activo']===false)throw new DonorError('DONOR_MODEL_INVALID','Selecciona un modelo activo de la marca.');
  if(previous&&(previous['marcaId']!==input.marcaId||previous['modeloId']!==input.modeloId||previous['anio']!==input.anio))throw new DonorError('DONOR_IDENTITY_LOCKED','El vehículo registrado conserva su marca, modelo y año.',409);
  if(previous&&input.revision!==previous['revision'])throw new DonorError('DONOR_REVISION_CONFLICT','El inventario cambió en otra pestaña. Vuelve a abrirlo antes de guardar.',409);
  const now=new Date().toISOString();
  const value={ferreteriaId:storeId,marcaId:input.marcaId,modeloId:input.modeloId,marcaNombre:brand.data()?.['nombre'],modeloNombre:model.data()?.['nombre'],anio:input.anio,motor:text(input.motor),patente:text(input.patente,20),vin:text(input.vin,40),transmision:text(input.transmision,60),codigoInterno:text(input.codigoInterno,60),estado:['disponible','en_desarme','agotado'].includes(input.estado)?input.estado:'en_desarme',piezas:normalizeDonorParts(input.piezas,previous?.['piezas']||[]),fotosVehiculo:previous?.['fotosVehiculo']||[],revision:Number(previous?.['revision']||0)+1,creadoEn:previous?.['creadoEn']||now,actualizadoEn:now};
  tx.set(ref,value);return {id,...value};
 });
}
// Each piece commits independently; stable IDs make lost-response retries safe.
export async function publishDonorPart(storeId:string,vehicleId:string,itemId:string,actorId:string,admin:boolean){
 return db.runTransaction(async tx=>{
  const ref=db.collection(COLLECTIONS.donorVehicles).doc(vehicleId),storeRef=db.collection(COLLECTIONS.stores).doc(storeId);
  const [snapshot,store]=await Promise.all([tx.get(ref),tx.get(storeRef)]);const donor=snapshot.data();
  if(!donor||donor['ferreteriaId']!==storeId||!store.exists||!donorStore(store.data())||(!admin&&store.data()?.['usuarioDuenoId']!==actorId))throw new DonorError('AUTH_FORBIDDEN','No puedes publicar piezas de este vehículo.',403);
  const pieces=structuredClone(donor['piezas']||[]),part=pieces.find((p:any)=>p.id===itemId);
  if(!part||!part.seleccionada)throw new DonorError('DONOR_PART_NOT_FOUND','Pieza no seleccionada.',404);
  const now=new Date().toISOString(),offerId=donorOfferId(vehicleId,itemId),offerRef=db.collection(COLLECTIONS.storeProducts).doc(offerId);
  const existing=await tx.get(offerRef);
  const proposalRef=part.solicitudId?db.collection(COLLECTIONS.productRequests).doc(part.solicitudId):null;
  const proposal=proposalRef?await tx.get(proposalRef):null;
  if(existing.exists){
   part.ofertaId=offerId;part.estado='publicada';part.error='';
  }else if(!validDonorPrice(part)){
   part.estado='borrador';part.error='Completa precio mayor a cero, stock y estado de la pieza.';
  }else if(!part.productoMaestroId){
   const requestId=donorRequestId(vehicleId,itemId),requestRef=db.collection(COLLECTIONS.productRequests).doc(requestId),request=await tx.get(requestRef);
   if(!request.exists)tx.create(requestRef,{ferreteriaId:storeId,usuarioSolicitanteId:actorId,nombreProducto:`${part.nombre} ${donor['marcaNombre']} ${donor['modeloNombre']} ${donor['anio']}${donor['motor']?' · Motor '+donor['motor']:''}`,tipoSolicitud:'nuevo_producto',estado:'pendiente',publicado:false,cantidadReferencia:part.stock,precioReferencia:part.precio,vehiculoDonanteId:vehicleId,piezaDonanteId:itemId,fechaCreacion:now,fechaResolucion:null,notasAdmin:'Vehículo de origen informado por el local. Verificar variante y compatibilidad técnica antes de vincular.'});
   part.solicitudId=requestId;part.estado='pendiente_revision';part.error=request.data()?.['estado']==='rechazada'?'Solicitud rechazada. Revisa la variante y selecciona un maestro válido.':'Pendiente de identificar y validar la variante en el catálogo maestro.';
  }else{
   const master=await tx.get(db.collection(COLLECTIONS.masterProducts).doc(part.productoMaestroId));
   if(!master.exists||master.data()?.['estado']==='inactivo'||!productMatchesBusinessType(master.data()||{},store.data()?.['tipoNegocio'])||!matchesDonor(master.data(),donor)){
    part.estado='borrador';part.error='El producto maestro no está activo o no tiene compatibilidad registrada para este vehículo.';
   }else{
    const offer={ferreteriaId:storeId,productoMaestroId:part.productoMaestroId,vehiculoDonanteId:vehicleId,piezaDonanteId:itemId,skuFerreteria:`${text(donor['codigoInterno'],30)||vehicleId.slice(0,8)}-${itemId.slice(-16)}`,precio:part.precio,stock:part.stock,condicion:part.condicion,incluyeIva:true,activo:true,publicado:true,fotosPublicacion:part.fotosPublicacion||[],creadoEn:now,actualizadoEn:now,vigenteDesde:now};
    tx.create(offerRef,offer);tx.update(storeRef,{catalogoActualizadoEn:now});
    if(proposalRef&&proposal?.data()?.['estado']==='pendiente')tx.update(proposalRef,{estado:'rechazada',notasAdmin:'Solicitud cerrada automáticamente: el local seleccionó una variante existente y publicó la pieza.',fechaResolucion:now});
    tx.create(db.collection(COLLECTIONS.priceHistory).doc(),{ferreteriaId:storeId,productoFerreteriaId:offerId,productoMaestroId:part.productoMaestroId,actorId,action:'donor_created',precioAnterior:null,precioNuevo:part.precio,incluyeIva:true,ocurridoEn:now,source:admin?'admin':'ferreteria',snapshotAnterior:null,snapshotNuevo:offer});
    part.ofertaId=offerId;part.estado='publicada';part.error='';part.fotosPublicacion=[]; // Offer becomes the sole photo owner.
   }
  }
  tx.update(ref,{piezas:pieces,revision:Number(donor['revision']||0)+1,actualizadoEn:now});
  return {id:itemId,estado:part.estado,ofertaId:part.ofertaId,error:part.error};
 });
}
export async function changeDonorPhotos(storeId:string,id:string,itemId:string,actorId:string,admin:boolean,change:(p:OfferPhoto[])=>OfferPhoto[]){
 return db.runTransaction(async tx=>{
  const ref=db.collection(COLLECTIONS.donorVehicles).doc(id);const [snapshot,store]=await Promise.all([tx.get(ref),tx.get(db.collection(COLLECTIONS.stores).doc(storeId))]);
  const value=snapshot.data();
  if(!value||value['ferreteriaId']!==storeId||!donorStore(store.data())||(!admin&&store.data()?.['usuarioDuenoId']!==actorId))throw new DonorError('AUTH_FORBIDDEN','No puedes modificar estas fotos.',403);
  const pieces=structuredClone(value['piezas']||[]),part=pieces.find((p:any)=>p.id===itemId);
  if(itemId==='vehiculo'){const after=change(value['fotosVehiculo']||[]);if(after.length>MAX_OFFER_PHOTOS)throw new ImageStorageError('OFFER_PHOTOS_LIMIT','Puedes subir hasta 12 fotos.');tx.update(ref,{fotosVehiculo:after,revision:Number(value['revision']||0)+1,actualizadoEn:new Date().toISOString()});return after;}
  if(!part||part.ofertaId)throw new DonorError('DONOR_PHOTOS_MOVED','Abre la publicación para administrar sus fotos.',409);
  const after=change(part.fotosPublicacion||[]);if(after.length>MAX_OFFER_PHOTOS)throw new ImageStorageError('OFFER_PHOTOS_LIMIT','Puedes subir hasta 12 fotos.');
  part.fotosPublicacion=after;tx.update(ref,{piezas:pieces,revision:Number(value['revision']||0)+1,actualizadoEn:new Date().toISOString()});return after;
 });
}
export async function uploadDonorPhoto(storeId:string,id:string,itemId:string,actorId:string,admin:boolean,body:Buffer,type:string){
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
 const uploaded=await uploadProductImage(body,type,`locales/${hash(storeId)}/ofertas/${hash(donorOfferId(id,itemId))}`);
 const photo:OfferPhoto={id:randomUUID(),url:uploaded.storageImageUrl,thumbnailUrl:uploaded.thumbnailImageUrl,storagePath:uploaded.storageImagePath,thumbnailPath:uploaded.thumbnailImagePath,uploadedAt:new Date().toISOString(),uploadedBy:actorId};
 try{return await changeDonorPhotos(storeId,id,itemId,actorId,admin,p=>[...p,photo]);}catch(error){await deleteOfferImageFiles(photo).catch(()=>console.error('DONOR_PHOTO_CLEANUP_FAILED'));throw error;}
}
