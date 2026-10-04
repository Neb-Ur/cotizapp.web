import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuotationOptimization as optimize } from '../lib/domain/quotation.js';
const offers = [ { productName:'Cemento', storeName:'A', storeId:'a', productoFerreteriaId:'offer-a', price:1000, stock:5 }, { productName:'Cemento', storeName:'B', storeId:'b', productoFerreteriaId:'offer-b', price:2000, stock:20 } ];
test('prices are final and selected store persists', () => {
 const result = optimize([{ productName:'Cemento', quantity:2, storeId:'b', productoFerreteriaId:'offer-b' }], offers);
 assert.equal(result.optimalTotal,4000); assert.equal(result.lines[0].bestStoreName,'B');
});
test('repeated product rows cannot oversell stock', () => {
 const result = optimize([{productName:'Cemento',quantity:4},{productName:'Cemento',quantity:4}],offers);
 assert.equal(result.optimalTotal,16000); assert.ok(result.lines.every(line=>line.bestStoreName==='B'));
 assert.ok(!result.singleStoreOptions.some(store=>store.storeName==='A'));
});
test('missing selected offer never silently switches store', () => {
 const result = optimize([{productName:'Cemento',quantity:2,productoFerreteriaId:'removed'}],offers);
 assert.equal(result.lines[0].unitPrice,0); assert.equal(result.mixedSaving,0);
});
