import {S3Client,DeleteObjectCommand} from '@aws-sdk/client-s3';
export function retirementMediaKeys(products,offers,donors,retainedProducts=[],retainedOffers=[]) {
 const keys=new Set();
 const photos=value=>{for(const photo of (value||[]).filter(Boolean)){if(photo.storagePath)keys.add(photo.storagePath);if(photo.thumbnailPath)keys.add(photo.thumbnailPath);}};
 for(const p of products.filter(Boolean)){if(p.imagenStoragePath)keys.add(p.imagenStoragePath);if(p.imagenMiniaturaPath)keys.add(p.imagenMiniaturaPath);}
 for(const offer of offers.filter(Boolean))photos(offer.fotosPublicacion);
 for(const donor of donors.filter(Boolean)){photos(donor.fotosVehiculo);for(const part of (donor.piezas||[]).filter(Boolean))photos(part.fotosPublicacion);}
 const retained=retirementMediaKeysInternal(retainedProducts,retainedOffers);
 return [...keys].filter(key=>!retained.has(key));
}
function retirementMediaKeysInternal(products,offers){
 const keys=new Set();
 const references=value=>{
  if(typeof value==='string' && /^https:\/\//.test(value)){
   try{const key=decodeURIComponent(new URL(value).pathname.slice(1));if(key.startsWith('productos/')||key.startsWith('locales/'))keys.add(key);}catch{}
  }else if(value && typeof value==='object')for(const child of Object.values(value))references(child);
 };
 references(products);references(offers);
 for(const p of products.filter(Boolean))for(const key of [p.imagenStoragePath,p.imagenMiniaturaPath])if(key)keys.add(key);
 for(const o of offers.filter(Boolean))for(const p of (o.fotosPublicacion||[]).filter(Boolean))for(const key of [p.storagePath,p.thumbnailPath])if(key)keys.add(key);
 return keys;
}
export async function removeRetirementMedia(keys,auth,secretValue){
 if(!keys.length)return;
 const {R2_ACCOUNT_ID:account,R2_BUCKET:bucket}=process.env;
 if(!account||!bucket)throw Error('R2_ACCOUNT_ID y R2_BUCKET son necesarios para borrar las imágenes; el manifiesto permite reintentar.');
 if(keys.some(key=>!key.startsWith('productos/')&&!key.startsWith('locales/')||key.split('/').some(part=>!part||part==='..'||part==='.')))throw Error('RETIREMENT_MEDIA_PATH_INVALID');
 const client=new S3Client({region:'auto',endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId:await secretValue(auth,'FINDI_R2_ACCESS_KEY_ID'),secretAccessKey:await secretValue(auth,'FINDI_R2_SECRET_ACCESS_KEY')}});
 try{for(const Key of keys)await client.send(new DeleteObjectCommand({Bucket:bucket,Key}));}finally{client.destroy();}
}
