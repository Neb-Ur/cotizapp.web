import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {S3Client,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {firestoreFixture} from './helpers/firestore-fixture.mjs';
import {uploadOfferPhoto,removeOfferPhoto,changeOfferPhotos} from '../lib/services/offer-photos.service.js';
import {attributedOfferPhotos} from '../lib/domain/offer-photo.js';
import {offerPhotosRouter} from '../lib/routes/offer-photos.routes.js';
import {CURRENT_STORE_AGREEMENT_VERSION} from '../lib/lib/legal.js';
import {storeAgreementDocumentHash} from '../lib/services/store-agreement.service.js';
const seed=()=>({ferreterias:{store:{usuarioDuenoId:'owner'},other:{usuarioDuenoId:'other-owner'}},productosFerreteria:{offer:{ferreteriaId:'store',productoMaestroId:'master',precio:10000,activo:true,publicado:true},other:{ferreteriaId:'other',productoMaestroId:'master',precio:20000,activo:true,publicado:true}},productosMaestro:{master:{nombre:'Radiador',galeriaJson:['https://generic.example/radiator.webp']}},contratosFerreteria:{agreement:{ferreteriaId:'store',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash(),estado:'vigente'}}});
const photo={id:'photo',url:'https://cdn.example/own.webp',thumbnailUrl:'https://cdn.example/thumb.webp',storagePath:'locales/'+'a'.repeat(24)+'/ofertas/'+'b'.repeat(24)+'/00000000-0000-0000-0000-000000000000/detalle.webp',thumbnailPath:'locales/'+'a'.repeat(24)+'/ofertas/'+'b'.repeat(24)+'/00000000-0000-0000-0000-000000000000/miniatura.webp',uploadedAt:new Date().toISOString(),uploadedBy:'owner'};
function storage(t){
 const env={FINDI_R2_ACCESS_KEY_ID:'test-key',FINDI_R2_SECRET_ACCESS_KEY:'test-secret',IMAGE_STORAGE_PROVIDER:'r2',R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET:'test-images',R2_PUBLIC_BASE_URL:'https://cdn.example'};
 for(const [key,value]of Object.entries(env)){const old=process.env[key];process.env[key]=value;t.after(()=>old===undefined?delete process.env[key]:process.env[key]=old);}
 const commands=[];t.mock.method(S3Client.prototype,'send',async command=>{commands.push(command);return {};});return commands;
}
test('actual R2 upload and deletion persist only the owned offer gallery and leave generic and other store images intact',async t=>{
 const f=firestoreFixture(t,seed()),commands=storage(t);
 const body=await sharp({create:{width:160,height:120,channels:3,background:'#153c56'}}).png().toBuffer();
 const photos=await uploadOfferPhoto('store','offer','owner',false,body,'image/png');
 assert.equal(photos.length,1);assert.match(photos[0].storagePath,/^locales\/[a-f0-9]{24}\/ofertas\/[a-f0-9]{24}\//);assert.equal(photos[0].uploadedBy,'owner');
 assert.deepEqual(f.get('productosFerreteria','offer').fotosPublicacion,photos);
 assert.equal(f.get('productosFerreteria','other').fotosPublicacion,undefined);assert.equal(f.get('productosMaestro','master').galeriaJson.length,1);
 assert.equal(commands.filter(c=>c instanceof PutObjectCommand).length,2);
 assert.deepEqual(await removeOfferPhoto('store','offer',photos[0].id,'owner',false),[]);
 assert.equal(commands.filter(c=>c instanceof DeleteObjectCommand).length,2);assert.equal(f.rows('historialPrecios').length,2);
});
test('ownership, offer identity, limit and removal identity are checked inside the write transaction',async t=>{
 const f=firestoreFixture(t,seed());
 await assert.rejects(changeOfferPhotos('store','offer','other-owner',false,photos=>[...photos,photo]),e=>e.status===403);
 await assert.rejects(changeOfferPhotos('store','other','owner',false,photos=>[...photos,photo]),e=>e.status===404);
 await assert.rejects(changeOfferPhotos('store','offer','owner',false,()=>Array.from({length:13},(_,i)=>({...photo,id:String(i)}))),e=>e.code==='OFFER_PHOTOS_LIMIT');
 await assert.rejects(removeOfferPhoto('store','offer','missing','owner',false),e=>e.status===404);
 assert.equal(f.get('productosFerreteria','offer').fotosPublicacion,undefined);assert.equal(f.rows('historialPrecios').length,0);
});
test('a rejected database attachment cleans up the two files already uploaded to R2',async t=>{
 const data=seed();data.productosFerreteria.offer.fotosPublicacion=Array(12).fill(photo);const f=firestoreFixture(t,data),commands=storage(t);
 const body=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer();
 await assert.rejects(uploadOfferPhoto('store','offer','owner',false,body,'image/png'),e=>e.code==='OFFER_PHOTOS_LIMIT');
 assert.equal(commands.filter(c=>c instanceof DeleteObjectCommand).length,2);assert.equal(f.get('productosFerreteria','offer').fotosPublicacion.length,12);
});
test('public attribution comes from the visible offer, excludes hidden, expired and other products, and never exposes storage keys or actor IDs',()=>{
 const rows=[{productoFerreteriaId:'one',storeId:'store',storeName:'Desarmaduría Norte'},{productoFerreteriaId:'two',storeId:'second',storeName:'Local Sur'},{productoFerreteriaId:'expired',storeId:'expired',storeName:'Vencido'}];
 const result=attributedOfferPhotos([{id:'one',condicion:'usado',fotosPublicacion:[{...photo,storeName:'Forged attribution'}]},{id:'two',condicion:'nuevo',fotosPublicacion:[{...photo,id:'second-photo'}]},{id:'hidden',fotosPublicacion:[photo]},{id:'expired',vigenteHasta:'2000-01-01',fotosPublicacion:[photo]}],rows);
 assert.equal(result.length,2);assert.equal(result[0].storeName,'Desarmaduría Norte');assert.equal(result[0].condition,'usado');assert.equal(result[1].storeName,'Local Sur');
 assert.equal(result[0].storagePath,undefined);assert.equal(result[0].uploadedBy,undefined);
 assert.equal(attributedOfferPhotos([{id:'one',publicado:false,fotosPublicacion:[photo]}],rows).length,0);
});
test('owner checks run before parsing uploaded bytes, and access cannot be changed to an offer from another local',async t=>{
 firestoreFixture(t,seed());const route=offerPhotosRouter.stack.find(l=>l.route?.methods.post).route;
 assert.equal(route.stack[0].handle.name,'requireAuth');assert.equal(route.stack.length,5);
 const access=route.stack[2].handle;
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 let allowed=false;
 await access({params:{storeId:'store',offerId:'offer'},authUserId:'other-owner',authRole:'ferreteria',method:'POST'},res,()=>allowed=true);
 assert.equal(res.statusCode,403);assert.equal(allowed,false);
 const other={...res,statusCode:200};await access({params:{storeId:'store',offerId:'other'},authUserId:'owner',authRole:'ferreteria',method:'POST'},other,()=>allowed=true);
 assert.equal(other.statusCode,404);assert.equal(allowed,false);
});
