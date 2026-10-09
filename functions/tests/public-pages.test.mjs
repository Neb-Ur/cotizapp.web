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
 firestoreFixture(t,{productosMaestro:{master:product},categorias:{},subcategorias:{},familias:{},atributosProductoMaestro:{},definicionesAtributoFamilia:{},cachePublico:{meta:{dirty:false,policy:`data-modes-v1:${CURRENT_STORE_AGREEMENT_VERSION}:${storeAgreementDocumentHash()}:pilot=false`,version:'fixture',updatedAt,taxonomyDocId:'taxonomy',offerDocIds:[],productDocIds:['products']},taxonomy:{categories:[],subcategories:[],families:[]},products:{items:[product]}}});
 const res=response();
 await handler('/producto')({path:'/producto',originalUrl:'/producto?product=Cemento+gris+25+kg&ferreteriaId=south&cantidad=3&crearCotizacion=1'},res,error=>{throw error;});
 assert.equal(res.statusCode,302);
 assert.equal(res.location,'/productos/cemento-gris-25-kg?ferreteriaId=south&cantidad=3&crearCotizacion=1');
 const empty=response();await handler('/producto')({path:'/producto',originalUrl:'/producto'},empty,error=>{throw error;});assert.equal(empty.location,'/buscar');
 const page=response();await handler('/productos/:slug')({path:'/productos/cemento-gris-25-kg',params:{slug:'cemento-gris-25-kg'}},page,error=>{throw error;});
 assert.match(page.body,/<p role="status">Cargando precios de las ferreterías…<\/p>/);
 assert.doesNotMatch(page.body,/AggregateOffer/);
 assert.match(page.body,/<meta property="og:image" content="https:\/\/example.test\/cemento.webp">/);
 assert.match(page.body,/<link rel="canonical" href="https:\/\/cotizapp-d71c8.web.app\/productos\/cemento-gris-25-kg">/);
});
