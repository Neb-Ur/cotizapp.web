import {createHash,randomUUID} from 'node:crypto';
import {db} from '../lib/firebase.js';
import {COLLECTIONS} from '../lib/collections.js';
import {ImageStorageError,uploadProductImage,deleteOfferImageFiles} from './image-storage.service.js';
import {MAX_OFFER_PHOTOS,type OfferPhoto} from '../domain/offer-photo.js';

export async function changeOfferPhotos(storeId:string,offerId:string,actorId:string,admin:boolean,change:(photos:OfferPhoto[])=>OfferPhoto[]) {
 return db.runTransaction(async tx=>{
  const storeRef=db.collection(COLLECTIONS.stores).doc(storeId),offerRef=db.collection(COLLECTIONS.storeProducts).doc(offerId);
  const [store,offer]=await Promise.all([tx.get(storeRef),tx.get(offerRef)]);
  if(!store.exists||!offer.exists||offer.data()?.['ferreteriaId']!==storeId)throw new ImageStorageError('CATALOGO_NOT_FOUND','Publicación no encontrada.',404);
  if(!admin&&store.data()?.['usuarioDuenoId']!==actorId)throw new ImageStorageError('AUTH_FORBIDDEN','No puedes modificar esta publicación.',403);
  const before:OfferPhoto[]=offer.data()?.['fotosPublicacion']||[];
  const after=change(structuredClone(before));
  if(after.length>MAX_OFFER_PHOTOS)throw new ImageStorageError('OFFER_PHOTOS_LIMIT',`Puedes subir hasta ${MAX_OFFER_PHOTOS} fotos por publicación.`);
  const now=new Date().toISOString();
  tx.update(offerRef,{fotosPublicacion:after,actualizadoEn:now});
  tx.update(storeRef,{catalogoActualizadoEn:now});
  tx.create(db.collection(COLLECTIONS.priceHistory).doc(),{ferreteriaId:storeId,productoFerreteriaId:offerId,productoMaestroId:offer.data()?.['productoMaestroId'],actorId,action:'photos_updated',precioAnterior:offer.data()?.['precio'],precioNuevo:offer.data()?.['precio'],incluyeIva:true,ocurridoEn:now,source:admin?'admin':'ferreteria',snapshotAnterior:{fotosPublicacion:before},snapshotNuevo:{fotosPublicacion:after}});
  return after;
 });
}
export async function uploadOfferPhoto(storeId:string,offerId:string,actorId:string,admin:boolean,body:Buffer,contentType:string) {
 const hash=(id:string)=>createHash('sha256').update(id).digest('hex').slice(0,24);
 const uploaded=await uploadProductImage(body,contentType,`locales/${hash(storeId)}/ofertas/${hash(offerId)}`);
 const photo:OfferPhoto={id:randomUUID(),url:uploaded.storageImageUrl,thumbnailUrl:uploaded.thumbnailImageUrl,storagePath:uploaded.storageImagePath,thumbnailPath:uploaded.thumbnailImagePath,uploadedAt:new Date().toISOString(),uploadedBy:actorId};
 try {return await changeOfferPhotos(storeId,offerId,actorId,admin,photos=>[...photos,photo]);}
 catch(error){await deleteOfferImageFiles(photo).catch(()=>console.error('OFFER_PHOTO_UPLOAD_CLEANUP_FAILED'));throw error;}
}
export async function removeOfferPhoto(storeId:string,offerId:string,photoId:string,actorId:string,admin:boolean) {
 let removed:OfferPhoto|undefined;
 const photos=await changeOfferPhotos(storeId,offerId,actorId,admin,current=>{
  removed=current.find(p=>p.id===photoId);
  if(!removed)throw new ImageStorageError('OFFER_PHOTO_NOT_FOUND','La foto ya no está disponible.',404);
  return current.filter(p=>p.id!==photoId);
 });
 await deleteOfferImageFiles(removed!).catch(()=>console.error('OFFER_PHOTO_DELETE_CLEANUP_FAILED'));
 return photos;
}
