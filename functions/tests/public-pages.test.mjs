import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPagesRouter } from '../lib/routes/public-pages.routes.js';
import { CURRENT_STORE_AGREEMENT_VERSION } from '../lib/lib/legal.js';
import { storeAgreementDocumentHash } from '../lib/services/store-agreement.service.js';
import { firestoreFixture } from './helpers/firestore-fixture.mjs';
const product={id:'master',nombre:'Cemento gris 25 kg',imagenPrincipalUrl:'https://example.test/cemento.webp'};
function response() {return {statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(c){this.statusCode=c;return this;},type(){return this;},send(body){this.body=body;return this;},redirect(code,url){this.statusCode=code;this.location=url;return this;}};}
function handler(path){return publicPagesRouter.stack.find(layer=>layer.route?.path===path).route.stack.at(-1).handle;}
test('legacy product routes preserve quotation parameters and product metadata uses the product image',async t=>{
 const updatedAt=new Date().toISOString();
 firestoreFixture(t,{productosMaestro:{master:product},categorias:{},subcategorias:{},familias:{},atributosProductoMaestro:{},definicionesAtributoFamilia:{},cachePublico:{meta:{dirty:false,policy:`data-modes-v8:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,version:'fixture',updatedAt,taxonomyDocId:'taxonomy',offerDocIds:['offers'],productDocIds:['products']},taxonomy:{categories:[],subcategories:[],families:[]},offers:{items:[{productoMaestroId:'master',storePilot:true,price:100,stock:1},{productoMaestroId:'master',offerPilot:true,price:50,stock:1}]},products:{items:[product]}}});
 const res=response();
 await handler('/producto')({path:'/producto',originalUrl:'/producto?product=Cemento+gris+25+kg&ferreteriaId=south&cantidad=3&crearCotizacion=1'},res,error=>{throw error;});
 assert.equal(res.statusCode,302);
 assert.equal(res.location,'/productos/cemento-gris-25-kg?ferreteriaId=south&cantidad=3&crearCotizacion=1');
 const empty=response();await handler('/producto')({path:'/producto',originalUrl:'/producto'},empty,error=>{throw error;});assert.equal(empty.location,'/buscar');
 const page=response();await handler('/productos/:slug')({path:'/productos/cemento-gris-25-kg',params:{slug:'cemento-gris-25-kg'}},page,error=>{throw error;});
 assert.match(page.body,/<p role="status">Cargando precios de los locales…<\/p>/);
 assert.doesNotMatch(page.body,/AggregateOffer/);
 assert.match(page.body,/<meta property="og:image" content="https:\/\/example.test\/cemento.webp">/);
 assert.match(page.body,/<link rel="canonical" href="https:\/\/trovio.cl\/productos\/cemento-gris-25-kg">/);
});

test('initial product HTML exposes real price, stock, condition and explicit fitment without pilot offers',async t=>{
 const part={...product,id:'radiator-real',nombre:'Radiador Hyundai Accent',categoriaId:'cat-repuestos-automotrices',compatibilidadVehiculos:[{marcaId:'hyundai',modeloId:'accent',marcaNombre:'Hyundai',modeloNombre:'Accent',anioDesde:2015,anioHasta:2018}]};
 const updatedAt=new Date().toISOString();
 const offer={productoMaestroId:part.id,storeId:'local-real',storeName:'Local real',price:25000,stock:1,condition:'usado',storeCommune:'Santiago'};
 firestoreFixture(t,{productosMaestro:{[part.id]:part},categorias:{},subcategorias:{},familias:{},atributosProductoMaestro:{},definicionesAtributoFamilia:{},cachePublico:{'catalog-revision':{revision:802},meta:{dirty:false,policy:`data-modes-v8:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,version:'real-offer-fixture',updatedAt,taxonomyDocId:'taxonomy',offerDocIds:['offers'],productDocIds:['products']},taxonomy:{categories:[],subcategories:[],families:[]},offers:{items:[offer,{...offer,storeName:'Local simulado',storePilot:true,price:1},{...offer,storeName:'Local agotado',stock:0,price:3}]},products:{items:[part]}}});
 const page=response();await handler('/productos/:slug')({path:'/productos/radiador-hyundai-accent',params:{slug:'radiador-hyundai-accent'}},page,e=>{throw e;});
 assert.equal(page.statusCode,200);assert.match(page.body,/\$25\.000/);assert.match(page.body,/Stock: 1 · Estado: Usado/);assert.match(page.body,/Hyundai Accent · 2015–2018/);assert.match(page.body,/href="\/vehiculos\/hyundai-accent"/);
 assert.doesNotMatch(page.body,/Local simulado|Local agotado/);
 const schema=JSON.parse(page.body.match(/<script[^>]*type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(schema['@graph'][0].offers.lowPrice,25000);assert.equal(schema['@graph'][0].offers.offers[0].itemCondition,'https://schema.org/UsedCondition');
});
