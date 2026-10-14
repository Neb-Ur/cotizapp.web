import {createHash} from 'node:crypto';
import {automotiveProductName,normalizeProductApplications} from '../../lib/domain/product-vehicle.js';
export const VARIANT_BATCH='trovio-master-variants-2026-10-14';
export function masterVehicleVariants(products,offers,extraApplications,now){
 const masters=new Map();const publications=[];
 function master(base,application,part){
  const applications=normalizeProductApplications([application]);
  const id='seed-variant-'+createHash('sha256').update(JSON.stringify([base.id,application.marcaId,application.modeloId,application.anioDesde,application.anioHasta])).digest('hex').slice(0,24);
  if(!masters.has(id))masters.set(id,{collection:'productosMaestro',id,data:{...base,id:undefined,nombrePieza:part,detalleVariante:'Semilla (Prueba)',nombre:automotiveProductName(part,applications,'Semilla (Prueba)'),compatibilidadVehiculos:applications,compatibilidadReferencial:true,catalogoNivel:'producto_comercial',estado:'activo',imagenPrincipalUrl:'',imagenStorageUrl:'',imagenMiniaturaUrl:'',imagenExternaUrl:'',imagenStoragePath:'',imagenMiniaturaPath:'',galeriaJson:[],origenImagen:'',imagenReferencial:false,descripcionCorta:'Variante de prueba. Vehículo y rango de años simulados; no acredita compatibilidad real.',descripcionLarga:'Ficha semilla para probar el catálogo de variantes. Deben verificarse código, motor, transmisión, medidas y fotografías de la pieza antes de utilizarla como referencia real.',esPrueba:true,lotePrueba:VARIANT_BATCH,creadoEn:now,actualizadoEn:now}});
  return id;
 }
 for(const offer of offers){
  if(offer.esPrueba!==true||offer.lotePrueba!=='trovio-auto-seed-2026-10-13')throw Error('VARIANT_SOURCE_NOT_SEED');
  const base=products.find(p=>p.id===offer.productoMaestroId);if(!base)throw Error('VARIANT_SOURCE_PRODUCT_MISSING');
  const part=base.nombre.replace(/ automotriz$/i,'');
  const applications=normalizeProductApplications(offer.asociacionesVehiculos);if(!applications.length)throw Error('VARIANT_SOURCE_COMPATIBILITY_REQUIRED');
  for(const [i,a]of applications.entries()){
   const productId=master(base,a,part);
   const id='seed-offer-'+createHash('sha256').update(offer.id+':'+productId).digest('hex').slice(0,24);
   publications.push({collection:'real_productosFerreteria',id,data:{...offer,id:undefined,productoMaestroId:productId,skuFerreteria:id.toUpperCase(),asociacionesVehiculos:[],stock:Math.floor(offer.stock/applications.length)+(i<offer.stock%applications.length?1:0),esPrueba:true,lotePrueba:VARIANT_BATCH,origenOfertaSemillaId:offer.id,activo:true,publicado:true,creadoEn:now,actualizadoEn:now}});
  }
 }
 for(const a of extraApplications){master({id:'radiador-kuv100-semilla',categoriaId:'cat-repuestos-automotrices',subcategoriaId:'sub-repuestos-motor-y-electricidad',familiaId:'fam-repuestos-radiadores',marca:'Por especificar',marcaId:null,unidadVenta:'Unidad',presentacion:'Por especificar',tipoProducto:'Radiador',origenContenido:'original',referenciaDerechosContenido:'Trovio: semilla editorial de variantes'},a,'Radiador');}
 return {masters:[...masters.values()],offers:publications};
}
