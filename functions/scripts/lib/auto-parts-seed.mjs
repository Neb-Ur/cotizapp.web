import {normalizeBrand} from '../../lib/domain/brand-identity.js';
import {normalizeVehicleApplications} from '../../lib/domain/vehicle-application.js';
import {isOfferCondition} from '../../lib/domain/offer-condition.js';
export function buildAutoPartsSeed(seed,brands,models,now) {
 const documents=[];const identities=new Set();const pairs=new Set();
 const push=(collection,id,data)=>{const key=collection+'/'+id;if(identities.has(key))throw Error('SEED_DUPLICATE_ID');identities.add(key);documents.push({collection,id,data});};
 for(const store of seed.stores){
  if(!['repuestos','desarmaduria'].includes(store.businessType)||!store.name.includes('(Prueba)'))throw Error('SEED_STORE_INVALID');
  push('usuarios',store.ownerId,{rol:'ferreteria',nombre:store.name,correo:store.ownerId+'@example.invalid',telefono:'',direccion:'',region:'',ciudad:'',comuna:'',estadoCuenta:'activo',esPrueba:true,lotePrueba:seed.batch,marketingConsent:false,creadoEn:now});
  push('real_ferreterias',store.id,{usuarioDuenoId:store.ownerId,nombreComercial:store.name,razonSocial:'Entidad ficticia para pruebas Trovio',rut:null,tipoNegocio:store.businessType,direccion:'',region:'',ciudad:'',comuna:'',latitud:null,longitud:null,correoContactoPublico:'',telefonoContactoPublico:'',estado:'activo',contratoEstado:'pendiente',esPrueba:true,lotePrueba:seed.batch,creadoEn:now,actualizadoEn:now,catalogoActualizadoEn:now});
 }
 for(const offer of seed.offers){
  if(!seed.stores.some(s=>s.id===offer.storeId)||!Number.isInteger(offer.price)||offer.price<=0||!Number.isInteger(offer.stock)||offer.stock<0||!isOfferCondition(offer.condition))throw Error('SEED_OFFER_INVALID');
  const pair=offer.storeId+'/'+offer.productId;if(pairs.has(pair))throw Error('SEED_DUPLICATE_STORE_PRODUCT');pairs.add(pair);
  const applications=normalizeVehicleApplications(offer.vehicles.map(([brandName,modelName,anioDesde,anioHasta])=>{
   const matches=brands.filter(b=>normalizeBrand(b.nombre)===normalizeBrand(brandName));
   if(matches.length!==1)throw Error('SEED_BRAND_MISSING_OR_AMBIGUOUS');const brand=matches[0];
   const found=models.filter(m=>m.marcaId===brand.id&&normalizeBrand(m.nombre)===normalizeBrand(modelName)&&m.activo!==false);
   if(found.length!==1)throw Error('SEED_MODEL_MISSING_OR_AMBIGUOUS');
   return {marcaId:brand.id,modeloId:found[0].id,anioDesde,anioHasta,marcaNombre:brand.nombre,modeloNombre:found[0].nombre};
  }));
  push('real_productosFerreteria',offer.id,{ferreteriaId:offer.storeId,productoMaestroId:offer.productId,skuFerreteria:offer.id.toUpperCase(),precio:offer.price,stock:offer.stock,condicion:offer.condition,incluyeIva:true,activo:true,publicado:true,patrocinado:false,esPrueba:true,lotePrueba:seed.batch,condicionesOferta:'SOLO PRUEBA. Local ficticio; precio, stock y asociaciones de vehículos simulados. No acredita compatibilidad real ni está disponible para compra o retiro.',asociacionesVehiculos:applications,vigenteDesde:now,vigenteHasta:null,creadoEn:now,actualizadoEn:now});
 }
 return documents;
}
export function missingAutoPartsSeedDocuments(documents,existing) {
 return documents.filter(document=>{
  const old=existing.get(document.collection+'/'+document.id);if(!old)return true;
  for(const field of ['lotePrueba','ferreteriaId','productoMaestroId','usuarioDuenoId','rol'])if(document.data[field]!==undefined&&old[field]!==document.data[field])throw Error('SEED_IDENTITY_CONFLICT:'+document.id);
  if(old.esPrueba!==true)throw Error('SEED_NOT_A_TEST_RECORD:'+document.id);
  return false;
 });
}
