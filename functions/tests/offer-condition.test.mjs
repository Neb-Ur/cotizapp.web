import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFER_CONDITIONS, offerConditionLabel, normalizeOfferCondition } from '../lib/domain/offer-condition.js';
import { buildQuotationOptimization } from '../lib/domain/quotation.js';
import { captureQuotationPricing } from '../lib/domain/quotation-validity.js';
import { verificationSnapshot } from '../lib/services/quotation-verification.service.js';
import { storeCatalogRouter } from '../lib/routes/store-catalog.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';

const offer={productoMaestroId:'p',productoFerreteriaId:'o',storeId:'s',storeName:'Local',productName:'Producto',condition:'usado',price:100,stock:10};
const item={productName:'Producto',quantity:2,productoMaestroId:'p',productoFerreteriaId:'o',storeId:'s'};
test('a single-store comparison does not replace a selected used offer with a new one',()=>{
 const other={...offer,productoFerreteriaId:'other',storeId:'other-store',condition:'nuevo',price:1};
 const result=buildQuotationOptimization([item],[offer,other]);
 assert.equal(result.lines[0].condition,'usado');
 assert.ok(!result.singleStoreOptions.some(store=>store.storeId==='other-store'));
});
test('condition is captured with the price and does not change when the live offer changes',()=>{
 const project={id:'q',items:[item]};const original=captureQuotationPricing(project,null,[offer],100000);
 const retained=captureQuotationPricing(project,original,[{...offer,condition:'nuevo',price:900}],200000);
 const result=buildQuotationOptimization(project.items,retained.pricingOffers);
 assert.equal(result.lines[0].condition,'usado');assert.equal(result.optimalTotal,200);
 assert.equal(verificationSnapshot({...project,...retained}).lines[0].condition,'usado');
 assert.equal(buildQuotationOptimization(project.items,[{...offer,condition:undefined}]).lines[0].condition,'sin_especificar');
 assert.equal(normalizeOfferCondition(undefined),'sin_especificar');
 assert.equal(offerConditionLabel('para_reparar'),'Para reparar');
});

const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const handle=method=>storeCatalogRouter.stack.find(layer=>layer.route?.path==='/ferreterias/:storeId/catalogo/:offerId'&&layer.route.methods[method]).route.stack.at(-1).handle;
test('catalog edits validate condition, retain publication state and preserve condition on legacy updates',async t=>{
 const fixture=firestoreFixture(t,{ferreterias:{s:{usuarioDuenoId:'owner'}},productosMaestro:{p:{nombre:'Producto'}},productosFerreteria:{o:{ferreteriaId:'s',productoMaestroId:'p',precio:100,stock:10,activo:true,publicado:true}},contratosFerreteria:{agreement:{ferreteriaId:'s',estado:'vigente',version:CURRENT_STORE_AGREEMENT_VERSION,documentHash:storeAgreementDocumentHash()}}});
 const request=body=>({authRole:'ferreteria',authUserId:'owner',params:{storeId:'s',offerId:'o'},body});
 for(const condicion of ['inactivo',null,42]){const res=response();await handle('patch')(request({condicion}),res);assert.equal(res.statusCode,400);}
 for(const condicion of OFFER_CONDITIONS){const res=response();await handle('patch')(request({condicion}),res);assert.equal(res.statusCode,200);assert.equal(fixture.get('productosFerreteria','o').condicion,condicion);}
 const res=response();await handle('patch')(request({precio:250}),res);
 const updated=fixture.get('productosFerreteria','o');assert.equal(updated.condicion,'para_reparar');assert.equal(updated.activo,true);assert.equal(updated.publicado,true);
 assert.equal(fixture.rows('historialPrecios').at(-1).snapshotNuevo.condicion,'para_reparar');
 const forbidden=response();await handle('patch')({...request({condicion:'nuevo'}),authUserId:'other'},forbidden);assert.equal(forbidden.statusCode,403);
});
