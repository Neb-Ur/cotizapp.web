import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateProductSearch } from '../lib/domain/product-search.js';
import { searchRouter } from '../lib/routes/search.routes.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';

function catalog(count = 135) {
  const products = Array.from({length:count}, (_, index) => ({id:`p${index}`,nombre:`Producto ${String(index).padStart(3,'0')}`,marca:'Genérico',imagenPrincipalUrl:'/product.png',categoriaId:index%2?'other':'cat',subcategoriaId:'sub',familiaId:'fam'}));
  const searchRows = products.flatMap((product, index) => [
    {productoMaestroId:product.id,productoFerreteriaId:`offer${index}`,productName:product.nombre,storeId:'north',storeName:'Cadena',sku:'',price:1000+index,categoryId:index%2?'other':'cat',subcategoryId:'sub',familyId:'fam',storeLatitude:0,storeLongitude:0},
    {productoMaestroId:product.id,productoFerreteriaId:`second${index}`,productName:product.nombre,storeId:'south',storeName:'Cadena',sku:'',price:2000+index,categoryId:index%2?'other':'cat',subcategoryId:'sub',familyId:'fam',storeLatitude:1,storeLongitude:0}
  ]);
  return {version:'search-fixture',updatedAt:new Date().toISOString(),taxonomy:{categories:[],subcategories:[],families:[]},products,searchRows};
}
const defaults = {page:1,size:20,sort:'relevance'};
const handler = searchRouter.stack.find(layer => layer.route?.path === '/busqueda').route.stack.at(-1).handle;
function response() {return {statusCode:200,headers:{},set(key,value){this.headers[key]=value;return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('all products remain reachable beyond 100, with correct totals and disjoint pages',()=>{
  const snapshot=catalog();
  const pages=Array.from({length:7},(_,index)=>paginateProductSearch(snapshot,{...defaults,page:index+1}));
  assert.ok(pages.every(page=>page.total===135 && page.totalPages===7));
  assert.equal(pages[6].items.length,15);
  assert.equal(new Set(pages.flatMap(page=>page.items.map(item=>item.productoMaestroId))).size,135);
  assert.equal(pages[6].items.at(-1).productName,'Producto 134');
  assert.equal(pages[0].items[0].storeCount,2); // Homonymous branches remain separate.
  assert.equal(pages[0].items[0].imageUrl,'/product.png');
});
test('search and taxonomy filter the complete catalog before pagination',()=>{
  const snapshot=catalog();
  const found=paginateProductSearch(snapshot,{...defaults,query:'PRODUCTO 134',categoryId:'cat',subcategoryId:'sub',familyId:'fam'});
  assert.equal(found.total,1); assert.equal(found.items[0].productName,'Producto 134');
  assert.equal(paginateProductSearch(snapshot,{...defaults,query:'Producto 134',categoryId:'other'}).total,0);
  assert.equal(paginateProductSearch(snapshot,{...defaults,subcategoryId:'missing'}).total,0);
  assert.equal(paginateProductSearch(snapshot,{...defaults,familyId:'missing'}).total,0);
  assert.equal(paginateProductSearch(snapshot,{...defaults,categoryId:'cat'}).total,68);
});
test('price sorting applies before slicing and stable ties avoid repeated products',()=>{
  const snapshot=catalog();
  assert.equal(paginateProductSearch(snapshot,{...defaults,sort:'price-desc'}).items[0].productName,'Producto 134');
  assert.equal(paginateProductSearch(snapshot,{...defaults,sort:'price-asc',page:2}).items[0].minPrice,1020);
  for(const offer of snapshot.searchRows)offer.price=1000;
  const first=paginateProductSearch(snapshot,{...defaults,sort:'stores'});
  const second=paginateProductSearch(snapshot,{...defaults,sort:'stores',page:2});
  assert.equal(first.items[0].productName,'Producto 000');
  assert.equal(second.items[0].productName,'Producto 020');
});
test('proximity excludes unknown and distant branches before price aggregation',()=>{
  const snapshot=catalog(2);
  snapshot.searchRows.push({...snapshot.searchRows[0],storeId:'unknown',storeLatitude:null,storeLongitude:null,price:1});
  const nearby=paginateProductSearch(snapshot,{...defaults,proximity:{latitude:0,longitude:0,radiusKm:5}});
  assert.equal(nearby.total,2);assert.equal(nearby.items[0].storeCount,1);
  assert.equal(nearby.items[0].minPrice,1000);assert.equal(nearby.items[0].maxPrice,1000);
  assert.equal(nearby.items[0].nearestDistanceKm,0);
  const distant=paginateProductSearch(snapshot,{...defaults,proximity:{latitude:10,longitude:10,radiusKm:5}});
  assert.equal(distant.total,2);assert.ok(distant.items.every(item=>item.storeCount===0));
});
test('an out-of-range page is clamped after catalog shrink; empty totals remain truthful',()=>{
  assert.equal(paginateProductSearch(catalog(2),{...defaults,page:7}).page,1);
  const empty=paginateProductSearch(catalog(0),{...defaults,page:7});
  assert.deepEqual(empty.items,[]);assert.equal(empty.total,0);assert.equal(empty.page,1);
});
test('paged search rejects invalid pagination, order and partial proximity before accessing data',async()=>{
  for(const query of [{page:'0'},{page:'1.5'},{size:'51'},{size:'0'},{sort:'unknown'},{latitude:'0'},{latitude:'91',longitude:'0',radiusKm:'5'}]){
    const res=response();await handler({query:{vista:'productos',...query}},res);
    assert.equal(res.statusCode,400);
  }
});
test('API returns product pages and legacy offer arrays with and without offers',async t=>{
  firestoreFixture(t);
  const {db}=await import('../lib/lib/firebase.js');
  const {COLLECTIONS}=await import('../lib/lib/collections.js');
  for(const hasOffers of [true,false]){
    const snapshot=catalog(135);
    if(!hasOffers)snapshot.searchRows=[];
    const cache=db.collection(COLLECTIONS.publicCache);
    await cache.doc('meta').set({dirty:false,version:`paged-search-${hasOffers}`,updatedAt:snapshot.updatedAt,policy:`data-modes-v1:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,taxonomyDocId:'taxonomy',productDocIds:['products'],offerDocIds:['offers']});
    await cache.doc('taxonomy').set(snapshot.taxonomy);
    await cache.doc('products').set({items:snapshot.products});await cache.doc('offers').set({items:snapshot.searchRows});
    const res=response();await handler({query:{vista:'productos',page:'7',size:'20'}},res);
    assert.equal(res.body.data.total,135);
    assert.equal(res.body.data.items.length,15);
    assert.equal(res.body.data.items[0].storeCount,hasOffers?2:0);
    assert.equal(res.headers['Cache-Control'],'no-store');
    const legacy=response();await handler({query:{query:'Producto 134'}},legacy);
    assert.ok(Array.isArray(legacy.body.data));assert.equal(legacy.body.data.length,hasOffers?2:0);
  }
});

test('master products without any stores remain searchable with their catalog details',()=>{
  const snapshot=catalog();snapshot.searchRows=[];
  const found=paginateProductSearch(snapshot,{...defaults,query:'Producto 134',categoryId:'cat',familyId:'fam'});
  assert.equal(found.total,1);assert.equal(found.items[0].productName,'Producto 134');
  assert.equal(found.items[0].storeCount,0);assert.equal(found.items[0].imageUrl,'/product.png');
  assert.deepEqual(found.items[0].sellers,[]);
});
test('unavailable products sort after priced products and inactive masters stay excluded',()=>{
  const snapshot=catalog(3);snapshot.searchRows=snapshot.searchRows.filter(row=>row.productoMaestroId==='p1');
  snapshot.products.push({id:'inactive',nombre:'Inactive',estado:'inactivo'});
  for(const sort of ['price-asc','price-desc','relevance','stores']){
    const found=paginateProductSearch(snapshot,{...defaults,sort});
    assert.equal(found.total,3);assert.equal(found.items[0].productName,'Producto 001');
    assert.equal(found.items[1].storeCount,0);
  }
});
test('brand searches use the master catalog even when the product has no offers',()=>{
  const snapshot=catalog(1);snapshot.searchRows=[];snapshot.products[0].marca='Marca Especial';
  assert.equal(paginateProductSearch(snapshot,{...defaults,query:'MARCA ESPECIAL'}).total,1);
});
