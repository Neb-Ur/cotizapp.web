import test from 'node:test';import assert from 'node:assert/strict';
import {aggregateStoreDailyAnalytics as aggregate} from '../lib/domain/store-daily-analytics.js';
const now=new Date('2026-10-08T05:00:00Z');
const stores=[{id:'a',nombreComercial:'Tienda A'},{id:'b',nombreComercial:'Tienda B'}];
const products=[{id:'p',nombre:'Cemento',estado:'activo'}];
const offers=[{productoMaestroId:'p',productoFerreteriaId:'oa',storeId:'a',storeName:'Tienda A',productName:'Cemento',price:1000,stock:50},{productoMaestroId:'p',productoFerreteriaId:'ob',storeId:'b',storeName:'Tienda B',productName:'Cemento',price:2000,stock:50}];
const catalog=offers.map(o=>({id:o.productoFerreteriaId,productoMaestroId:o.productoMaestroId,ferreteriaId:o.storeId,stock:o.stock,precio:o.price,actualizadoEn:'2026-10-01'}));
const quote=(id,items,extra={})=>({id,items,createdAt:'2026-10-06',...extra});
const run=quotes=>aggregate(stores,quotes,offers,catalog,products,[],now);
test('attributes explicit selections only to the chosen store, never every seller',()=>{
 const result=run([quote('q',[{productName:'Nombre antiguo',productoMaestroId:'p',productoFerreteriaId:'ob',storeId:'b',quantity:3}])]);
 assert.equal(result.get('a').quotationCount,0);assert.equal(result.get('b').quotedUnits,3);assert.equal(result.get('b').activeQuotedAmount,6000);assert.equal(result.get('b').topProducts[0].name,'Cemento');
});
test('deduplicates quotations and products while counting repeated lines and quantities',()=>{
 const result=run([quote('q',[{productName:'Cemento',quantity:2},{productName:'Cemento',quantity:3}])]).get('a');
 assert.equal(result.quotationCount,1);assert.equal(result.quotedLines,2);assert.equal(result.quotedUnits,5);assert.equal(result.quotedProducts,1);assert.equal(result.topProducts[0].quotationCount,1);
});
test('active money excludes old, closed and unavailable quotations',()=>{
 const result=run([quote('old',[{productName:'Cemento',quantity:1}],{createdAt:'2026-01-01'}),quote('closed',[{productName:'Cemento',quantity:1}],{status:'closed'}),quote('missing',[{productName:'Cemento',storeId:'a',productoFerreteriaId:'removed',quantity:2}])]).get('a');
 assert.equal(result.quotationCount,3);assert.equal(result.activeQuotationCount,1);assert.equal(result.activeQuotedUnits,2);assert.equal(result.activeQuotedAmount,0);
});
test('uses a single selected store for all lines and respects proximity',()=>{
 assert.equal(run([quote('q',[{productName:'Cemento',quantity:3}],{singleStoreId:'b'})]).get('b').activeQuotedAmount,6000);
 const result=aggregate(stores,[quote('q',[{productName:'Cemento',quantity:1}],{proximity:{latitude:0,longitude:0,radiusKm:1}})],offers.map(o=>({...o,storeLatitude:10,storeLongitude:10})),catalog,products,[],now);
 assert.equal(result.get('a').quotationCount,0);
});
test('snapshots are idempotent, include stores with zero activity and do not expose customers',()=>{
 const quotes=[quote('q',[{productName:'Cemento',quantity:1}],{ownerId:'private-owner',name:'Private project',address:'Private address'})];
 const first=run(quotes);assert.deepEqual([...first],[...run(quotes)]);assert.equal(first.get('b').quotedUnits,0);
 const json=JSON.stringify([...first]);for(const secret of ['private-owner','Private project','Private address','quoteIds'])assert.ok(!json.includes(secret));
});
test('compares new quotations by creation date and emits catalog stock and stale-price signals',()=>{
 const result=aggregate(stores,[quote('last-week',[{productName:'Cemento',storeId:'a',quantity:1}],{createdAt:'2026-09-28'}),quote('this-week',[{productName:'Cemento',storeId:'a',quantity:2}])],offers,[{...catalog[0],stock:0,actualizadoEn:'2026-01-01'}],products,[],now).get('a');
 assert.equal(result.recentQuotationCount,1);assert.equal(result.previousQuotationCount,1);assert.equal(result.catalog.outOfStock,1);assert.equal(result.catalog.stalePrices,1);
});
