import test from 'node:test';
import assert from 'node:assert/strict';
import {captureQuotationPricing,quotationExpired} from '../lib/domain/quotation-validity.js';
import {projectView} from '../lib/services/quotation.service.js';
const now=Date.parse('2026-10-09T12:00:00Z');
const offer={productName:'Cemento',productoMaestroId:'cement',productoFerreteriaId:'offer',storeId:'store',storeName:'Ferretería',price:1000,stock:100};
const project={id:'quote',name:'Obra',items:[{productName:'Cemento',quantity:2}],createdAt:new Date(now).toISOString()};
test('saved prices last exactly ten days and are not replaced by live price changes',async()=>{
 const pricing=captureQuotationPricing(project,undefined,[offer],now);
 assert.equal(pricing.validUntil,'2026-10-19T12:00:00.000Z');
 const saved={...project,...pricing};
 const view=await projectView(saved,[{...offer,price:9000}]);assert.equal(view.totalOptimal,2000);
 const edited={...project,items:[{productName:'Cemento',quantity:3}]};
 const updated=captureQuotationPricing(edited,saved,[{...offer,price:9000}],now+86400000);
 assert.equal(updated.pricingOffers[0].price,1000);assert.equal(updated.validUntil,pricing.validUntil);
 assert.equal((await projectView({...edited,...updated},[])).totalOptimal,3000);
});
test('explicit renewal captures new prices and restarts the ten-day validity',()=>{
 const saved={...project,...captureQuotationPricing(project,undefined,[offer],now)};
 const renewed=captureQuotationPricing(project,saved,[{...offer,price:9000}],now+86400000,true);
 assert.equal(renewed.pricingOffers[0].price,9000);assert.equal(renewed.validUntil,'2026-10-20T12:00:00.000Z');
 assert.equal(quotationExpired(saved,now+10*86400000-1),false);assert.equal(quotationExpired(saved,now+10*86400000),true);
});
test('adding another product captures its price without changing existing prices or the deadline',()=>{
 const saved={...project,...captureQuotationPricing(project,undefined,[offer],now)};
 const added={...project,items:[...project.items,{productName:'Clavos',quantity:1}]};
 const pricing=captureQuotationPricing(added,saved,[{...offer,price:9000},{...offer,productName:'Clavos',productoMaestroId:'nails',productoFerreteriaId:'nails-offer',price:500}],now+86400000);
 assert.deepEqual(pricing.pricingOffers.map(o=>o.price),[1000,500]);assert.equal(pricing.validUntil,saved.validUntil);
});
