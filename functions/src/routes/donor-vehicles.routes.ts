import {Router,raw,type Request,type Response,type NextFunction} from 'express';
import {requireAuth,requireRole} from '../lib/auth.js';
import {requireStoreWriteAccess} from '../lib/ownership.js';
import {requireCurrentStoreAgreement} from '../services/store-agreement.service.js';
import {COLLECTIONS} from '../lib/collections.js';
import {db} from '../lib/firebase.js';
import {row,rows} from '../repositories/firestore.repository.js';
import {ok,fail} from '../lib/http.js';
import {DonorError,donorStore,donorTemplate,matchesDonor,samePart} from '../domain/donor-vehicle.js';
import {donorView,saveDonor,publishDonorPart,changeDonorPhotos,uploadDonorPhoto} from '../services/donor-vehicles.service.js';
import {ImageStorageError,IMAGE_CONTENT_TYPES,MAX_IMAGE_BYTES,deleteOfferImageFiles} from '../services/image-storage.service.js';
import {publicOfferPhotos,MAX_OFFER_PHOTOS,type OfferPhoto} from '../domain/offer-photo.js';
import {productMatchesBusinessType} from '../domain/business-type.js';
export const donorVehiclesRouter=Router();
const base='/ferreterias/:storeId/vehiculos-donantes';
async function access(req:Request,res:Response,next:NextFunction){
 if(!await requireStoreWriteAccess(req,res,req.params.storeId))return;
 const store=await row(COLLECTIONS.stores,req.params.storeId);
 if(!store||!donorStore(store))return fail(res,'DONOR_STORE_TYPE_INVALID','El inventario por vehículo está disponible para desarmadurías y locales de repuestos.',403);
 if(req.method!=='GET'&&!await requireCurrentStoreAgreement(req,res,req.params.storeId))return;
 if(req.params.vehicleId){
  const vehicle=await row(COLLECTIONS.donorVehicles,req.params.vehicleId);
  if((req.method!=='PUT'||vehicle)&&(!vehicle||vehicle.ferreteriaId!==req.params.storeId))return fail(res,'DONOR_NOT_FOUND','Vehículo no encontrado.',404);
  if(req.method==='POST'&&req.params.itemId){
   const part=req.params.itemId==='vehiculo'?{fotosPublicacion:vehicle?.fotosVehiculo}:vehicle?.piezas?.find((p:any)=>p.id===req.params.itemId);
   if(!part||part.ofertaId)return fail(res,'DONOR_PART_NOT_AVAILABLE','Abre la publicación para administrar esta pieza.',409);
   if((part.fotosPublicacion||[]).length>=MAX_OFFER_PHOTOS)return fail(res,'OFFER_PHOTOS_LIMIT','Puedes subir hasta 12 fotos.',400);
  }
 }
 next();
}
const guarded=(fn:(req:Request,res:Response)=>Promise<any>)=>async(req:Request,res:Response)=>{try{return await fn(req,res);}catch(error){if(error instanceof DonorError||error instanceof ImageStorageError)return fail(res,error.code,error.message,error.status);throw error;}};
async function inventory(storeId:string){
 const [vehicles,offers]=await Promise.all([db.collection(COLLECTIONS.donorVehicles).where('ferreteriaId','==',storeId).get(),db.collection(COLLECTIONS.storeProducts).where('ferreteriaId','==',storeId).get()]);
 const byId=new Map(offers.docs.map(d=>[d.id,{id:d.id,...d.data()} as any]));
 return vehicles.docs.map(d=>donorView({id:d.id,...d.data(),piezas:(d.data()?.['piezas']||[]).map((p:any)=>{
  const offer=p.ofertaId?byId.get(p.ofertaId):null;
  return offer?{...p,precio:offer.precio,stock:offer.stock,condicion:offer.condicion,fotosPublicacion:offer.fotosPublicacion||[],publicado:offer.publicado,estado:offer.publicado&&offer.activo?'publicada':'retirada'}:p;
 })})).sort((a,b)=>b.actualizadoEn.localeCompare(a.actualizadoEn));
}
donorVehiclesRouter.get(base,requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>ok(res,{vehicles:await inventory(req.params.storeId),template:donorTemplate()})));
donorVehiclesRouter.put(base+'/:vehicleId',requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>ok(res,donorView(await saveDonor(req.params.storeId,req.params.vehicleId,req.body,req.authUserId!,req.authRole==='admin')))));
donorVehiclesRouter.get(base+'/:vehicleId/candidatos',requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>{
 const donor=await row(COLLECTIONS.donorVehicles,req.params.vehicleId),store=await row(COLLECTIONS.stores,req.params.storeId);
 const products=(await rows(COLLECTIONS.masterProducts)).filter(p=>p.estado!=='inactivo'&&productMatchesBusinessType(p,store?.tipoNegocio)&&matchesDonor(p,donor));
 return ok(res,{items:products.map(p=>({id:p.id,nombre:p.nombre,nombrePieza:p.nombrePieza||'',detalleVariante:p.detalleVariante||'',sugeridaPara:(donor?.piezas||[]).filter((part:any)=>samePart(part.nombre,p.nombrePieza)).map((part:any)=>part.id)}))});
}));
donorVehiclesRouter.post(base+'/:vehicleId/publicar',requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>{
 const donor=await row(COLLECTIONS.donorVehicles,req.params.vehicleId);const results=[];
 const requested=req.body?.piezaIds;
 if(!Array.isArray(requested)||!requested.length||requested.length>10||requested.some(id=>typeof id!=='string'))throw new DonorError('DONOR_BATCH_INVALID','Selecciona entre 1 y 10 piezas por lote.');
 const ids=new Set(requested);
 const selected=donor.piezas.filter((p:any)=>p.seleccionada&&ids.has(p.id));
 if(selected.length!==ids.size)throw new DonorError('DONOR_BATCH_INVALID','Alguna pieza ya no está seleccionada. Recarga el vehículo.',409);
 // Sequential commits avoid burst pressure on SQL. Failed pieces remain retryable.
 for(const part of selected){
  try{results.push(await publishDonorPart(req.params.storeId,req.params.vehicleId,part.id,req.authUserId!,req.authRole==='admin'));}
  catch(error){if(error instanceof DonorError&&error.status===403)throw error;results.push({id:part.id,estado:'fallida',error:'No se pudo guardar esta pieza. Reintenta; las demás conservan su avance.'});console.error('DONOR_PART_PUBLISH_FAILED',{code:error instanceof DonorError?error.code:(error as any)?.code||'WRITE_FAILED',constraint:(error as any)?.constraint||null,message:error instanceof Error?error.message.slice(0,300):'Unknown write failure'});}
 }
 return ok(res,{results,vehicle:(await inventory(req.params.storeId)).find(v=>v.id===req.params.vehicleId)});
}));
const photoPath=base+'/:vehicleId/piezas/:itemId/fotos';
donorVehiclesRouter.post(photoPath,requireAuth,requireRole('ferreteria','admin'),access,raw({type:IMAGE_CONTENT_TYPES,limit:MAX_IMAGE_BYTES}),guarded(async(req,res)=>ok(res,{photos:publicOfferPhotos(await uploadDonorPhoto(req.params.storeId,req.params.vehicleId,req.params.itemId,req.authUserId!,req.authRole==='admin',req.body,(req.get('Content-Type')||'').split(';')[0].toLowerCase()))},201)));
donorVehiclesRouter.delete(photoPath+'/:photoId',requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>{
 let removed:OfferPhoto|undefined;
 const photos=await changeDonorPhotos(req.params.storeId,req.params.vehicleId,req.params.itemId,req.authUserId!,req.authRole==='admin',current=>{removed=current.find(p=>p.id===req.params.photoId);if(!removed)throw new DonorError('PHOTO_NOT_FOUND','Foto no encontrada.',404);return current.filter(p=>p.id!==req.params.photoId);});
 await deleteOfferImageFiles(removed!).catch(()=>console.error('DONOR_PHOTO_DELETE_FAILED'));return ok(res,{photos:publicOfferPhotos(photos)});
}));

donorVehiclesRouter.delete(base+'/:vehicleId',requireAuth,requireRole('ferreteria','admin'),access,guarded(async(req,res)=>{
 const removed=await db.runTransaction(async tx=>{
  const ref=db.collection(COLLECTIONS.donorVehicles).doc(req.params.vehicleId),snapshot=await tx.get(ref);
  const offers=await tx.get(db.collection(COLLECTIONS.storeProducts).where('vehiculoDonanteId','==',req.params.vehicleId));
  if(!offers.empty)throw new DonorError('DONOR_HAS_OFFERS','Elimina las publicaciones de este vehículo antes de eliminarlo.',409);
  const value=snapshot.data();if(!value||value['ferreteriaId']!==req.params.storeId)throw new DonorError('DONOR_NOT_FOUND','Vehículo no encontrado.',404);
  const requests=await tx.get(db.collection(COLLECTIONS.productRequests).where('vehiculoDonanteId','==',req.params.vehicleId));
  for(const request of requests.docs)if(request.data()?.['estado']==='pendiente')tx.update(request.ref,{estado:'rechazada',notasAdmin:'Vehículo eliminado por el local.',fechaResolucion:new Date().toISOString()});
  tx.delete(ref);return [...(value['fotosVehiculo']||[]),...(value['piezas']||[]).flatMap((p:any)=>p.fotosPublicacion||[])];
 });
 await Promise.allSettled(removed.map((p:OfferPhoto)=>deleteOfferImageFiles(p)));return ok(res,{deleted:true});
}));
