import {Router,raw,type Request,type Response,type NextFunction} from 'express';
import {requireAuth,requireRole} from '../lib/auth.js';
import {requireStoreWriteAccess} from '../lib/ownership.js';
import {requireCurrentStoreAgreement} from '../services/store-agreement.service.js';
import {row} from '../repositories/firestore.repository.js';
import {COLLECTIONS} from '../lib/collections.js';
import {ok,fail} from '../lib/http.js';
import {IMAGE_CONTENT_TYPES,MAX_IMAGE_BYTES,ImageStorageError} from '../services/image-storage.service.js';
import {uploadOfferPhoto,removeOfferPhoto} from '../services/offer-photos.service.js';
import {MAX_OFFER_PHOTOS,publicOfferPhotos} from '../domain/offer-photo.js';
export const offerPhotosRouter=Router();
const path='/ferreterias/:storeId/catalogo/:offerId/fotos';
async function access(req:Request,res:Response,next:NextFunction){
 if(!await requireStoreWriteAccess(req,res,req.params.storeId)||!await requireCurrentStoreAgreement(req,res,req.params.storeId))return;
 const offer=await row(COLLECTIONS.storeProducts,req.params.offerId);
 if(!offer||offer.ferreteriaId!==req.params.storeId)return fail(res,'CATALOGO_NOT_FOUND','Publicación no encontrada.',404);
 if(req.method==='POST'&&(offer.fotosPublicacion||[]).length>=MAX_OFFER_PHOTOS)return fail(res,'OFFER_PHOTOS_LIMIT',`Puedes subir hasta ${MAX_OFFER_PHOTOS} fotos por publicación.`,400);
 next();
}
offerPhotosRouter.post(path,requireAuth,requireRole('ferreteria','admin'),access,raw({type:IMAGE_CONTENT_TYPES,limit:MAX_IMAGE_BYTES}),async(req,res)=>{
 res.set('Cache-Control','no-store');
 try {return ok(res,{photos:publicOfferPhotos(await uploadOfferPhoto(req.params.storeId,req.params.offerId,req.authUserId!,req.authRole==='admin',req.body,(req.get('Content-Type')||'').split(';')[0].trim().toLowerCase()))},201);}
 catch(error){if(error instanceof ImageStorageError)return fail(res,error.code,error.message,error.status);throw error;}
});
offerPhotosRouter.delete(path+'/:photoId',requireAuth,requireRole('ferreteria','admin'),access,async(req,res)=>{
 res.set('Cache-Control','no-store');
 try {return ok(res,{photos:publicOfferPhotos(await removeOfferPhoto(req.params.storeId,req.params.offerId,req.params.photoId,req.authUserId!,req.authRole==='admin'))});}
 catch(error){if(error instanceof ImageStorageError)return fail(res,error.code,error.message,error.status);throw error;}
});
