import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { imageStorageConfig, prepareProductImage, MAX_IMAGE_BYTES, IMAGE_CACHE_CONTROL } from '../lib/services/image-storage.service.js';
import { imagesRouter } from '../lib/routes/images.routes.js';

test('R2 is disabled by default and requires an HTTPS public origin and bucket',()=>{
  assert.equal(imageStorageConfig({}).configured,false);
  const env={IMAGE_STORAGE_PROVIDER:'r2',R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET:'findi-imagenes',R2_PUBLIC_BASE_URL:'https://imagenes.example.com/'};
  assert.equal(imageStorageConfig(env).configured,true);
  for(const bad of ['http://images.example.com','https://user:pass@example.com','https://example.com?token=secret','https://example.com/subpath'])
    assert.equal(imageStorageConfig({...env,R2_PUBLIC_BASE_URL:bad}).configured,false);
  assert.equal(imageStorageConfig({...env,R2_ACCOUNT_ID:'not-an-id'}).configured,false);
  assert.equal(imageStorageConfig({...env,IMAGE_STORAGE_PROVIDER:'disabled'}).configured,false);
});

test('uploads generate bounded WebP variants and strip original metadata',async()=>{
  const input=await sharp({create:{width:1600,height:2400,channels:3,background:'#ffffff'}}).jpeg().withMetadata({exif:{IFD0:{Copyright:'private'}}}).toBuffer();
  const result=await prepareProductImage(input,'image/jpeg');
  const main=await sharp(result.main).metadata(),thumb=await sharp(result.thumbnail).metadata();
  assert.equal(main.format,'webp');assert.equal(thumb.format,'webp');
  assert.ok(main.width<=1280&&main.height<=1280&&thumb.width<=480&&thumb.height<=480);
  assert.ok(Math.abs(main.width/main.height-1600/2400)<.002);
  assert.equal(main.exif,undefined);assert.equal(thumb.exif,undefined);
  assert.equal(result.width,main.width);assert.equal(result.height,main.height);
  assert.equal(IMAGE_CACHE_CONTROL,'public, max-age=31536000, immutable');
});

test('rejects fake images, SVG, empty files and excessive upload sizes',async()=>{
  for(const [body,type] of [[Buffer.from('fake'),'image/png'],[Buffer.from('<svg></svg>'),'image/svg+xml'],[Buffer.alloc(0),'image/png'],[Buffer.alloc(MAX_IMAGE_BYTES+1),'image/jpeg']])
    await assert.rejects(()=>prepareProductImage(body,type),e=>e.status===400&&e.code.startsWith('IMAGE_'));
});

test('image upload route requires authentication and admin role before parsing bytes',()=>{
  const route=imagesRouter.stack.find(layer=>layer.route?.path==='/admin/imagenes/productos').route;
  assert.equal(route.methods.post,true);
  assert.equal(route.stack[0].handle.name,'requireAuth');
  assert.equal(route.stack.length,4);
});

test('R2 uploads both variants to unique keys and cleans up when either write fails',async t=>{
  const {S3Client,PutObjectCommand,DeleteObjectCommand}=await import('@aws-sdk/client-s3');
  const {uploadProductImage}=await import('../lib/services/image-storage.service.js');
  const keys=['FINDI_R2_ACCESS_KEY_ID','FINDI_R2_SECRET_ACCESS_KEY','IMAGE_STORAGE_PROVIDER','R2_ACCOUNT_ID','R2_BUCKET','R2_PUBLIC_BASE_URL'];
  const previous=keys.map(key=>process.env[key]);
  t.after(()=>keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i]}));
  Object.assign(process.env,{FINDI_R2_ACCESS_KEY_ID:'test-key',FINDI_R2_SECRET_ACCESS_KEY:'test-secret',IMAGE_STORAGE_PROVIDER:'r2',R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET:'findi-images',R2_PUBLIC_BASE_URL:'https://images.example.com'});
  const calls=[];let failure=false;
  t.mock.method(S3Client.prototype,'send',async command=>{calls.push(command);if(failure&&command instanceof PutObjectCommand&&command.input.Key.endsWith('miniatura.webp'))throw new Error('Internal provider failure');return {};});
  const input=await sharp({create:{width:100,height:200,channels:3,background:'#fff'}}).png().toBuffer();
  const first=await uploadProductImage(input,'image/png'),second=await uploadProductImage(input,'image/png');
  assert.notEqual(first.storageImagePath,second.storageImagePath);
  assert.ok(first.storageImageUrl.startsWith('https://images.example.com/productos/'));
  assert.ok(calls.every(c=>c.input.CacheControl===IMAGE_CACHE_CONTROL&&c.input.ContentType==='image/webp'));
  calls.length=0;failure=true;
  await assert.rejects(()=>uploadProductImage(input,'image/png'),e=>e.status===502&&e.code==='IMAGE_UPLOAD_FAILED'&&!e.message.includes('Internal provider'));
  assert.equal(calls.filter(c=>c instanceof DeleteObjectCommand).length,2);
});

test('saving R2 variants preserves external fallback and legacy URL replacement clears old variants',async t=>{
  const {firestoreFixture}=await import('./helpers/firestore-fixture.mjs');
  const {masterProductsRouter}=await import('../lib/routes/master-products.routes.js');
  const external='https://maker.example/product.png',storage='https://images.example/product.webp',thumbnail='https://images.example/thumbnail.webp';
  const fixture=firestoreFixture(t,{productosMaestro:{product:{nombre:'Producto',marca:'Sin marca',imagenPrincipalUrl:external,imagenExternaUrl:external,origenImagen:'external_url',origenContenido:'original',referenciaDerechosContenido:'Ficha original'}}});
  const handler=masterProductsRouter.stack.find(layer=>layer.route?.path==='/productos-maestro/:id'&&layer.route.methods.patch).route.stack.at(-1).handle;
  const response=()=>({status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
  const uploaded=response();await handler({params:{id:'product'},body:{imagenPrincipalUrl:storage,imagenStorageUrl:storage,imagenStoragePath:'product/main.webp',imagenMiniaturaUrl:thumbnail,imagenMiniaturaPath:'product/thumb.webp'},authUserId:'admin'},uploaded);
  assert.equal(uploaded.body.ok,true);assert.equal(fixture.get('productosMaestro','product').imagenExternaUrl,external);
  assert.equal(fixture.get('productosMaestro','product').imagenMiniaturaUrl,thumbnail);
  const replaced=response();await handler({params:{id:'product'},body:{imagenPrincipalUrl:external},authUserId:'admin'},replaced);
  assert.equal(replaced.body.ok,true);assert.equal(fixture.get('productosMaestro','product').imagenMiniaturaUrl,'');
  assert.equal(fixture.get('productosMaestro','product').imagenStorageUrl,'');
});
