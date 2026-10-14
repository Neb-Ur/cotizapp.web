import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeProductApplications,automotiveProductName,offerApplicationsWithinProduct} from '../lib/domain/product-vehicle.js';
import {paginateProductSearch} from '../lib/domain/product-search.js';
const a=(from=2016,to=2019)=>({marcaId:'mahindra',modeloId:'kuv',marcaNombre:'Mahindra',modeloNombre:'KUV100',anioDesde:from,anioHasta:to});
test('variant names come from structured piece, vehicle and ranges; unknown years are rejected',()=>{
 assert.equal(automotiveProductName('Radiador',[a()]),'Radiador Mahindra KUV100 2016–2019');
 assert.equal(automotiveProductName('Radiador',[a(),a(2021,2023)],'Motor de prueba'),'Radiador Mahindra KUV100 2016–2019, 2021–2023 · Motor de prueba');
 assert.throws(()=>normalizeProductApplications([{...a(),anioDesde:null,anioHasta:null}]),/PRODUCT_VEHICLE_YEARS_REQUIRED/);
 assert.throws(()=>normalizeProductApplications([a(),a(2018,2021)]));
 assert.equal(offerApplicationsWithinProduct([a(2017,2018)],[a()]),true);assert.equal(offerApplicationsWithinProduct([a(2015,2020)],[a()]),false);
});
test('master compatibility discovers no-offer variants and never uses unrelated offer declarations to claim a match',()=>{
 const snapshot={version:'master',updatedAt:'',taxonomy:{categories:[],subcategories:[],families:[]},products:[{id:'early',nombre:'Radiador Mahindra KUV100 2016–2019',estado:'activo',compatibilidadVehiculos:[a()]},{id:'late',nombre:'Radiador Mahindra KUV100 2020–2023',estado:'activo',compatibilidadVehiculos:[a(2020,2023)]},{id:'generic',nombre:'Radiador genérico'}],searchRows:[{productoMaestroId:'generic',storeId:'wrong',storeName:'Wrong',price:1,vehicleApplications:[a()]}]};
 const query={vehicleBrandId:'mahindra',vehicleModelId:'kuv',vehicleYear:2018,page:1,size:20,sort:'price-asc'};
 const early=paginateProductSearch(snapshot,query);assert.equal(early.total,1);assert.equal(early.items[0].productoMaestroId,'early');assert.equal(early.items[0].storeCount,0);assert.equal(early.items[0].minPrice,0);
 assert.equal(paginateProductSearch(snapshot,{...query,vehicleYear:2021}).items[0].productoMaestroId,'late');
 assert.equal(paginateProductSearch(snapshot,{...query,vehicleYear:2014}).total,0);
 assert.equal(paginateProductSearch(snapshot,{...query,storeId:'wrong'}).total,0);
});
