import test from 'node:test';import assert from 'node:assert/strict';
import {retirementMediaKeys} from '../scripts/lib/retirement-media.mjs';
test('media retirement collects owned files once and preserves files referenced by hardware',()=>{
 const products=[{imagenStoragePath:'productos/old/detail.webp',imagenMiniaturaPath:'productos/shared/thumb.webp'}];
 const photo={storagePath:'locales/old/photo.webp',thumbnailPath:'locales/old/thumb.webp'};
 assert.deepEqual(retirementMediaKeys(products,[{fotosPublicacion:[photo]}],[{fotosVehiculo:[photo]}],[{imagenMiniaturaPath:'productos/shared/thumb.webp'}]),['productos/old/detail.webp','locales/old/photo.webp','locales/old/thumb.webp']);
});

test('retirement preserves hardware references to the same CDN file through external fallback or galleries',()=>{
 assert.deepEqual(retirementMediaKeys([{imagenStoragePath:'productos/shared/detail.webp'}],[],[],[{galeriaJson:['https://images.example.test/productos/shared/detail.webp']}]),[]);
});

test('retirement tolerates relational rows without optional compatibility payloads',()=>{
 assert.deepEqual(retirementMediaKeys([null], [null], [null], [null], [null]),[]);
});
