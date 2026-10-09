import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogCacheIsFresh,nextCatalogTransition}from'../lib/domain/catalog-cache-validity.js';
test('unchanged catalogs survive age expiry but policy changes and offer time boundaries invalidate them',()=>{
 const now=Date.parse('2026-10-10T12:00:00Z');
 const meta={policy:'p',updatedAt:'2026-10-01T00:00:00Z',temporalValidityTracked:true,nextTransitionAt:null};
 assert.equal(catalogCacheIsFresh(meta,'p',now),true);
 assert.equal(catalogCacheIsFresh(meta,'new-policy',now),false);
 assert.equal(catalogCacheIsFresh({...meta,nextTransitionAt:'2026-10-10T12:01:00Z'},'p',now),true);
 assert.equal(catalogCacheIsFresh({...meta,nextTransitionAt:'2026-10-10T12:00:00Z'},'p',now),false);
 assert.equal(catalogCacheIsFresh({...meta,nextTransitionAt:'bad'},'p',now),false);
 assert.equal(catalogCacheIsFresh({policy:'p',updatedAt:'2026-10-01T00:00:00Z'},'p',now),false);
});
test('next refresh includes future unpublished offer starts and published offer expiration',()=>{
 const now=Date.parse('2026-10-10T12:00:00Z');
 assert.equal(nextCatalogTransition([{vigenteDesde:'2026-10-10T12:30:00Z'},{vigenteHasta:'2026-10-10T12:15:00Z'},{vigenteHasta:'2026-10-09T00:00:00Z'},{vigenteDesde:'invalid'}],now),'2026-10-10T12:15:00.000Z');
 assert.equal(nextCatalogTransition([],now),null);
});
