import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesVehicle, parseVehicleSearch } from '../lib/domain/vehicle-search.js';
import { paginateProductSearch } from '../lib/domain/product-search.js';
import { searchRouter } from '../lib/routes/search.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';

const application = (marcaId, modeloId, anioDesde, anioHasta) => ({marcaId,modeloId,anioDesde,anioHasta});
const filter = {vehicleBrandId:'toyota',vehicleModelId:'corolla',vehicleYear:2010};
const applications = [application('toyota','corolla',2008,2012),application('nissan','sentra',2015,2020)];
test('vehicle matching keeps brand/model/year in one declaration and includes interval endpoints', () => {
  assert.equal(matchesVehicle(applications,filter),true);
  for(const year of [2008,2012]) assert.equal(matchesVehicle(applications,{...filter,vehicleYear:year}),true);
  for(const wrong of [{vehicleYear:2015},{vehicleModelId:'sentra'},{vehicleBrandId:'nissan'}]) assert.equal(matchesVehicle(applications,{...filter,...wrong}),false);
  assert.equal(matchesVehicle(undefined,filter),false);
  assert.equal(matchesVehicle([application('toyota','corolla',null,null)],filter),false);
  assert.equal(matchesVehicle([application('toyota','corolla',null,null)],{vehicleBrandId:'toyota',vehicleModelId:'corolla'}),true);
});

function catalog() {
  return {version:'vehicle-filter-fixture',updatedAt:new Date().toISOString(),taxonomy:{categories:[],subcategories:[],families:[]},
    products:[{id:'part',nombre:'Alternador',compatibilidadVehiculos:applications,categoriaId:'cat-repuestos-automotrices'},{id:'base',nombre:'Referencia sin ofertas'}],
    searchRows:[
      {productoMaestroId:'part',productoFerreteriaId:'matching',storeId:'one',storeName:'Desarmaduría',price:5000,vehicleApplications:applications,storeLatitude:0,storeLongitude:0},
      {productoMaestroId:'part',productoFerreteriaId:'wrong',storeId:'two',storeName:'Ferretería',price:100,vehicleApplications:[application('toyota','yaris',2010,2010)],storeLatitude:0,storeLongitude:0}
    ]};
}
test('vehicle filtering precedes aggregation and pagination and combines with store, taxonomy and radius', () => {
  const snapshot=catalog(); const options={...filter,page:1,size:20,sort:'price-asc'};
  const found=paginateProductSearch(snapshot,options);
  assert.equal(found.total,1);assert.equal(found.items[0].minPrice,5000);assert.equal(found.items[0].storeCount,1);
  assert.deepEqual(found.items[0].sellers,['Desarmaduría']);
  assert.equal(paginateProductSearch(snapshot,{...options,storeId:'two'}).total,0);
  assert.equal(paginateProductSearch(snapshot,{...options,categoryId:'unrelated'}).total,0);
  const distant=paginateProductSearch(snapshot,{...options,proximity:{latitude:10,longitude:10,radiusKm:5}});assert.equal(distant.total,1);assert.equal(distant.items[0].storeCount,0);
  assert.equal(paginateProductSearch(snapshot,{page:1,size:20,sort:'stores'}).total,2);
});

test('API rejects malformed vehicle filters before accessing data', async () => {
  const handler=searchRouter.stack.find(l=>l.route?.path==='/busqueda').route.stack.at(-1).handle;
  for(const query of [{vehiculoModeloId:'corolla'},{vehiculoAnio:'2010'},{vehiculoMarcaId:['a','b']},
    {vehiculoMarcaId:'a',vehiculoModeloId:'b',vehiculoAnio:'2010.5'},
    {vehiculoMarcaId:'a',vehiculoModeloId:'b',vehiculoAnio:'2101'}]) {
    assert.throws(()=>parseVehicleSearch(query));
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await handler({query:{vista:'productos',...query}},res);
    assert.equal(res.statusCode,400);assert.equal(res.body.error.code,'SEARCH_INVALID_VEHICLE');
  }
});

test('public search and offer detail retain the same selected vehicle', async t => {
  const snapshot=catalog();
  firestoreFixture(t,{cachePublico:{meta:{dirty:false,version:snapshot.version,updatedAt:snapshot.updatedAt,
    policy:`data-modes-v5:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']},
    taxonomy:snapshot.taxonomy,products:{items:snapshot.products},offers:{items:snapshot.searchRows}}});
  const query={vehiculoMarcaId:'toyota',vehiculoModeloId:'corolla',vehiculoAnio:'2010'};
  const response=()=>({statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
  const search=searchRouter.stack.find(l=>l.route?.path==='/busqueda').route.stack.at(-1).handle;
  const res=response();await search({query:{vista:'productos',...query}},res);
  assert.equal(res.body.data.total,1);assert.equal(res.body.data.items[0].minPrice,5000);
  const legacy=response();await search({query},legacy);assert.equal(legacy.body.data.length,1);assert.equal(legacy.body.data[0].price,5000);
  const detail=searchRouter.stack.find(l=>l.route?.path==='/productos/detalle').route.stack.at(-1).handle;
  const offers=response();await detail({query:{producto:'Alternador',vista:'ofertas',...query}},offers);
  assert.equal(offers.body.data.stores.length,1);assert.equal(offers.body.data.stores[0].storeId,'one');
  assert.equal(offers.body.data.minPrice,5000);
});
