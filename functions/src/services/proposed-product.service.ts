import { automotiveIdentity, automotiveProductName } from '../domain/product-vehicle.js';
import { createHash } from 'node:crypto';
import { db } from '../lib/firebase.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText } from '../lib/values.js';
import { allowedProductAreas, isProductArea, productArea, type ProductArea } from '../domain/business-type.js';
import { ProductRequestError } from './product-request-resolution.service.js';
const key = (s: string) => normalizeText(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const slug = (s: string) => key(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
export interface ProposedProductDraft {name:string; area:ProductArea; barcode?:string; sku?:string; price:number; stock:number; categoryId?:string; subcategoryId?:string; familyId?:string; condition?:string; published?:boolean;}

/** Read/plan first. The caller executes write() only after ALL of its transaction reads. */
export async function prepareProposedProduct(tx:any, store:any, draft:ProposedProductDraft, donor?:any) {
  if (!isProductArea(draft.area) || !allowedProductAreas(store.tipoNegocio).includes(draft.area)) throw new ProductRequestError('PRODUCT_AREA_INVALID','Selecciona un tipo de producto permitido para este local.',400);
  if (normalizeText(draft.name).length < 3 || !Number.isFinite(draft.price) || draft.price <= 0 || !Number.isSafeInteger(draft.stock) || draft.stock < 0) throw new ProductRequestError('PRODUCT_DRAFT_INVALID','Revisa nombre, precio y stock del producto.',400);
  const [masters,categories,subs,families] = await Promise.all([COLLECTIONS.masterProducts,COLLECTIONS.categories,COLLECTIONS.subcategories,COLLECTIONS.families].map(name=>tx.get(db.collection(name))));
  const values=(snapshot:any)=>snapshot.docs.map((d:any)=>({id:d.id,...d.data()}));
  const all=values(masters);
  const name=normalizeText(draft.name).slice(0,200);
  const compatible=(p:any)=>!donor || p.compatibilidadVehiculos?.some((a:any)=>a.marcaId===donor.marcaId && a.modeloId===donor.modeloId && a.anioDesde===donor.anio && a.anioHasta===donor.anio);
  const matches=all.filter((p:any)=>p.estado!=='inactivo' && (p.esPrueba===true)===(store.esPrueba===true) && ((draft.barcode && p.codigoBarras===draft.barcode) || key(p.nombre)===key(name)) && compatible(p));
  if (matches.some((p:any)=>productArea(p)!==draft.area)) throw new ProductRequestError('PRODUCT_AREA_MISMATCH','El producto identificado pertenece a otro tipo. Separa los tipos en archivos distintos.',400);
  if (matches.length>1) throw new ProductRequestError('PRODUCT_MATCH_AMBIGUOUS','Hay varias coincidencias. Selecciona el producto desde el catálogo.',409);
  if(matches.length) return {master:matches[0],write:()=>{}};
  const defaultCategory = draft.area==='repuestos'?'cat-repuestos-automotrices':draft.area==='herramientas'?'cat-herramientas-y-consumibles':'cat-materiales-por-clasificar';
  const cats=values(categories), subRows=values(subs), familyRows=values(families).map((f:any)=>({...f,categoriaId:f.categoriaId || subRows.find((s:any)=>s.id===f.subcategoriaId)?.categoriaId}));
  let family=draft.familyId?familyRows.find((f:any)=>f.id===draft.familyId):null;
  if (draft.familyId && !family) throw new ProductRequestError('PRODUCT_TAXONOMY_INVALID','La familia seleccionada ya no existe.',400);
  // Checklist pieces use their own family, never a generic vehicle-wide taxonomy.
  if(donor && !family) family=familyRows.find((f:any)=>!f.id.startsWith('prueba-') && f.permiteVehiculos===true && key(f.nombre).replace(/(es|s)$/, '')===key(donor.partName).replace(/(es|s)$/, '') && cats.some((c:any)=>c.id===f.categoriaId && productArea({categoriaId:c.id})==='repuestos'));
  const categoryId=family?.categoriaId || draft.categoryId || defaultCategory;
  let category=cats.find((c:any)=>c.id===categoryId);
  if (draft.categoryId && !category) throw new ProductRequestError('PRODUCT_TAXONOMY_INVALID','La categoría seleccionada ya no existe.',400);
  if(productArea({categoriaId:categoryId})!==draft.area) throw new ProductRequestError('PRODUCT_AREA_MISMATCH','La taxonomía no corresponde al tipo elegido.',400);
  category ||= {id:categoryId,nombre:draft.area==='repuestos'?'Repuestos automotrices':draft.area==='herramientas'?'Herramientas y consumibles':'Materiales por clasificar',activo:true};
  const subName=donor?.system || 'Productos por clasificar';
  const subcategoryId=family?.subcategoriaId || draft.subcategoryId || `sub-${slug(categoryId)}-${slug(subName)}`;
  let sub=subRows.find((s:any)=>s.id===subcategoryId);
  if(draft.subcategoryId && !sub || sub && sub.categoriaId!==categoryId) throw new ProductRequestError('PRODUCT_TAXONOMY_INVALID','La subcategoría no pertenece a la categoría.',400);
  sub ||= {id:subcategoryId,categoriaId:categoryId,nombre:subName,activo:true};
  let familyId=family?.id || `fam-${slug(subcategoryId)}-${slug(donor?.partName || 'por-clasificar')}`;
  family ||= familyRows.find((f:any)=>f.id===familyId) || {id:familyId,categoriaId:categoryId,subcategoriaId:subcategoryId,nombre:donor?.partName || 'Productos por clasificar',permiteVehiculos:draft.area==='repuestos',activo:true};
  if(donor && family.permiteVehiculos !== true) throw new ProductRequestError('PRODUCT_TAXONOMY_INVALID','La familia seleccionada no permite compatibilidad vehicular.',400);
  if(store.esPrueba===true) { familyId=`prueba-${family.id.replace(/^(prueba-)+/, '')}`; family=familyRows.find((f:any)=>f.id===familyId) || {...family,id:familyId}; }
  const identity=`${draft.area}:${key(name)}:${draft.barcode||''}:${donor?`${donor.marcaId}:${donor.modeloId}:${donor.anio}`:''}`;
  const id=`propuesto-${hash(identity+':'+String(store.esPrueba===true))}`;
  const existing=all.find((p:any)=>p.id===id);
  if(existing) {
    if(existing.estado==='inactivo') throw new ProductRequestError('PRODUCT_INACTIVE','Este producto fue retirado. Contacta a Trovio para revisarlo.',409);
    if(productArea(existing)!==draft.area || !allowedProductAreas(store.tipoNegocio).includes(productArea(existing))) throw new ProductRequestError('PRODUCT_AREA_MISMATCH','La clasificación de este producto cambió. Revisa su ficha actual antes de publicarlo.',400);
    return {master:existing,write:()=>{}};
  }
  const master:any={id,nombre:name,categoriaId:categoryId,subcategoriaId:subcategoryId,familiaId:family.id,ambitoComercial:draft.area==='herramientas'?'ambos':draft.area==='repuestos'?'desarmaduria':'ferreteria',tipoProducto:donor?.partName || name,marca:'Sin marca',unidadVenta:'Unidad',codigoBarras:draft.barcode||null,estado:'activo',validacionPendiente:true,esPrueba:store.esPrueba===true,creadoEn:nowIso()};
  if(donor) Object.assign(master,{nombrePieza:donor.partName,detalleVariante:donor.motor||'',catalogoNivel:'producto_comercial',compatibilidadVehiculos:[{marcaId:donor.marcaId,modeloId:donor.modeloId,marcaNombre:donor.marcaNombre,modeloNombre:donor.modeloNombre,anioDesde:donor.anio,anioHasta:donor.anio}]});
  if(donor) {
    master.nombre=automotiveProductName(master.nombrePieza, master.compatibilidadVehiculos, master.detalleVariante);
    const canonical=all.find((p:any)=>p.estado!=='inactivo' && (p.esPrueba===true)===(store.esPrueba===true) && p.compatibilidadVehiculos?.length && automotiveIdentity(p)===automotiveIdentity(master));
    if(canonical) return {master:canonical,write:()=>{}};
  }
  return {master,write:()=>{
    if(!cats.some((c:any)=>c.id===categoryId)) tx.create(db.collection(COLLECTIONS.categories).doc(categoryId),category);
    if(!subRows.some((s:any)=>s.id===subcategoryId)) tx.create(db.collection(COLLECTIONS.subcategories).doc(subcategoryId),sub);
    if(!familyRows.some((f:any)=>f.id===family.id)) tx.create(db.collection(COLLECTIONS.families).doc(family.id),family);
    const {id:_,...body}=master; tx.create(db.collection(COLLECTIONS.masterProducts).doc(id),body);
  }};
}

export async function publishProposedProduct(storeId:string, actorId:string, draft:ProposedProductDraft) {
 return db.runTransaction(async tx=>{
  const storeRef=db.collection(COLLECTIONS.stores).doc(storeId), store=(await tx.get(storeRef)).data();
  if(!store) throw new ProductRequestError('STORE_NOT_FOUND','No existe el local.',404);
  const plan=await prepareProposedProduct(tx,store,draft);
  const id=`propuesta-${hash(`${storeId}:${plan.master.id}`)}`;
  const requestRef=db.collection(COLLECTIONS.productRequests).doc(id),offerRef=db.collection(COLLECTIONS.storeProducts).doc(id);
  const [request,offer,offers]=await Promise.all([tx.get(requestRef),tx.get(offerRef),tx.get(db.collection(COLLECTIONS.storeProducts).where('ferreteriaId','==',storeId).where('productoMaestroId','==',plan.master.id))]);
  if(request.exists) {
    if(request.data()?.['estado']==='rechazada' || !offer.exists || (draft.published!==false && (offer.data()?.['publicado']===false || offer.data()?.['activo']===false))) throw new ProductRequestError('PROPOSAL_NOT_PUBLISHED','Esta propuesta fue rechazada o su oferta fue retirada. Revisa el catálogo del local antes de publicarla nuevamente.',409);
    return {id,...request.data()};
  }
  const regular=offers.docs.find((d:any)=>!d.data()?.vehiculoDonanteId);
  if(regular) throw new ProductRequestError('CATALOGO_ALREADY_LINKED','Este producto ya está en tu catálogo. Edita su oferta existente.',409);
  const offerId=id, now=nowIso();
  plan.write();
  if(!offer.exists) tx.create(offerRef,{ferreteriaId:storeId,productoMaestroId:plan.master.id,skuFerreteria:draft.sku||'',codigoBarras:draft.barcode||null,precio:draft.price,stock:draft.stock,condicion:draft.condition||'sin_especificar',activo:true,publicado:draft.published!==false,incluyeIva:true,creadoEn:now,actualizadoEn:now});
  const proposal={ferreteriaId:storeId,usuarioSolicitanteId:actorId,nombreProducto:draft.name,precioReferencia:draft.price,cantidadReferencia:draft.stock,codigoBarras:draft.barcode||'',skuFerreteria:draft.sku||'',estado:'pendiente',tipoSolicitud:'nuevo_producto',publicado:draft.published!==false,productoMaestroSugeridoId:plan.master.id,productoFerreteriaId:offerId,publicacionProvisional:true,notasAdmin:'Publicado por el local; revisar clasificación y ficha.',fechaCreacion:now,fechaResolucion:null};
  tx.create(requestRef,proposal); tx.update(storeRef,{catalogoActualizadoEn:now});
  return {id,...proposal};
 });
}
