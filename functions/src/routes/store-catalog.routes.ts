import { vehicleApplicationsEnabled } from '../domain/vehicle-application.js';
import { Router } from 'express';
import { isOfferCondition, normalizeOfferCondition } from '../domain/offer-condition.js';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, row, createRow, patchRow } from '../repositories/firestore.repository.js';
import { canAccessOwner, requireStoreWriteAccess } from '../lib/ownership.js';
import { requireCurrentStoreAgreement } from '../services/store-agreement.service.js';
import { productMatchesBusinessType } from '../domain/business-type.js';
import { deleteOfferImageFiles } from '../services/image-storage.service.js';
export const storeCatalogRouter = Router();

const measurementUnits = ['kg', 'l', 'm', 'm2', 'm3', 'unidad'];

function optionalOfferDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offerEvidence(value: Record<string, any> | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return {
    condicion: normalizeOfferCondition(value['condicion']),
    precio: numberValue(value['precio']),
    stock: Math.max(0, Math.floor(numberValue(value['stock']))),
    incluyeIva: value['incluyeIva'] !== false,
    unidadMedidaPrecio: normalizeText(value['unidadMedidaPrecio']) || null,
    cantidadMedida: numberValue(value['cantidadMedida'], 0) || null,
    vigenteDesde: normalizeText(value['vigenteDesde']) || null,
    vigenteHasta: normalizeText(value['vigenteHasta']) || null,
    condicionesOferta: normalizeText(value['condicionesOferta']).slice(0, 500) || null,
    activo: value['activo'] !== false,
    publicado: value['publicado'] !== false,
    fotosPublicacion: value['fotosPublicacion'] || []
  };
}

storeCatalogRouter.get('/ferreterias/by-owner/:ownerId', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para consultar esta ferreteria.', 403);
  const store = (await rows(COLLECTIONS.stores)).find((item) => item.usuarioDuenoId === req.params.ownerId);
  return store ? ok(res, store) : fail(res, 'FERRETERIA_NOT_FOUND', 'No existe ferreteria para el usuario indicado.', 404);
});

storeCatalogRouter.get('/ferreterias/:storeId/catalogo', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  if (req.authRole !== 'admin' && req.authUserId !== store.usuarioDuenoId) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para consultar este catalogo.', 403);
  const [products,families] = await Promise.all([rows(COLLECTIONS.masterProducts),rows(COLLECTIONS.families)]);
  const vehicleFamilies = new Set(families.filter(f=>f.permiteVehiculos===true).map(f=>f.id));
  const productById = new Map(products.map((item) => [item.id, item]));
  const data = (await rows(COLLECTIONS.storeProducts))
    .filter((item) => item.ferreteriaId === req.params.storeId)
    .map((item) => ({ ...item, vehiculosEditables: !productById.get(item.productoMaestroId)?.compatibilidadVehiculos?.length && vehicleApplicationsEnabled(req.params.storeId) && vehicleFamilies.has(productById.get(item.productoMaestroId)?.familiaId), productoMaestro: productById.get(item.productoMaestroId) }))
    .filter((item) => !!item.productoMaestro && (req.authRole === 'admin' || productMatchesBusinessType(item.productoMaestro, store.tipoNegocio)));
  return ok(res, data);
});

storeCatalogRouter.post('/ferreterias/:storeId/catalogo', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  if (!(await requireCurrentStoreAgreement(req, res, req.params.storeId))) return;
  if (req.body?.condicion !== undefined && !isOfferCondition(req.body.condicion)) return fail(res, 'OFFER_CONDITION_INVALID', 'Selecciona una condición válida.', 400);
  const masterId = normalizeText(req.body?.productoMaestroId);
  const product = await row(COLLECTIONS.masterProducts, masterId);
  if (!product || product.estado === 'inactivo') return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro indicado.', 404);
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  if (!productMatchesBusinessType(product, store?.tipoNegocio)) return fail(res, 'STORE_PRODUCT_BUSINESS_TYPE_MISMATCH', 'Este producto no corresponde al tipo de negocio del local.', 400);
  const offerPayload = {
    condicion: normalizeOfferCondition(req.body?.condicion),
    ferreteriaId: req.params.storeId,
    productoMaestroId: masterId,
    skuFerreteria: normalizeText(req.body?.skuFerreteria),
    codigoBarras: normalizeText(req.body?.codigoBarras) || null,
    precio: Math.max(0, numberValue(req.body?.precio)),
    stock: Math.max(0, Math.floor(numberValue(req.body?.stock))),
    incluyeIva: true,
    unidadMedidaPrecio: measurementUnits.includes(normalizeText(req.body?.unidadMedidaPrecio))
      ? normalizeText(req.body?.unidadMedidaPrecio)
      : null,
    cantidadMedida: numberValue(req.body?.cantidadMedida, 0) > 0 ? numberValue(req.body?.cantidadMedida) : null,
    vigenteDesde: optionalOfferDate(req.body?.vigenteDesde) || nowIso(),
    vigenteHasta: optionalOfferDate(req.body?.vigenteHasta),
    condicionesOferta: normalizeText(req.body?.condicionesOferta).slice(0, 500),
    patrocinado: req.authRole === 'admin' && req.body?.patrocinado === true,
    activo: req.body?.activo !== false,
    publicado: req.body?.publicado !== false,
    creadoEn: nowIso(),
    actualizadoEn: nowIso()
  };
  const created = await db.runTransaction(async tx => {
    const storeRef = db.collection(COLLECTIONS.stores).doc(req.params.storeId);
    const store = await tx.get(storeRef);
    const existing = await tx.get(db.collection(COLLECTIONS.storeProducts)
      .where('ferreteriaId', '==', req.params.storeId).where('productoMaestroId', '==', masterId));
    if (!store.exists || existing.docs.some(doc=>!doc.data()?.['vehiculoDonanteId'])) return null;
    const ref = db.collection(COLLECTIONS.storeProducts).doc();
    tx.create(ref, offerPayload);
    tx.update(storeRef, { catalogoActualizadoEn: nowIso() });
    return { id: ref.id, ...offerPayload };
  });
  if (!created) return fail(res, 'CATALOGO_ALREADY_LINKED', 'El producto ya esta vinculado o la ferretería ya no está disponible.', 409);
  await createRow(COLLECTIONS.priceHistory, {
    ferreteriaId: req.params.storeId,
    productoFerreteriaId: created.id,
    productoMaestroId: masterId,
    actorId: req.authUserId,
    action: 'created',
    precioAnterior: null,
    precioNuevo: created.precio,
    incluyeIva: created.incluyeIva,
    ocurridoEn: nowIso(),
    source: 'ferreteria',
    snapshotAnterior: null,
    snapshotNuevo: offerEvidence(created)
  });
  return ok(res, { ...created, productoMaestro: product }, 201);
});

storeCatalogRouter.patch('/ferreterias/:storeId/catalogo/:offerId', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  if (!(await requireCurrentStoreAgreement(req, res, req.params.storeId))) return;
  const existing = await row(COLLECTIONS.storeProducts, req.params.offerId);
  if (!existing || existing.ferreteriaId !== req.params.storeId) return fail(res, 'CATALOGO_NOT_FOUND', 'Producto de ferreteria no encontrado.', 404);
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  const master = await row(COLLECTIONS.masterProducts, existing.productoMaestroId);
  if (req.authRole !== 'admin' && master && !productMatchesBusinessType(master, store?.tipoNegocio)) return fail(res, 'STORE_PRODUCT_BUSINESS_TYPE_MISMATCH', 'Este producto no corresponde a la clasificación del local.', 400);
  const patch: Record<string, unknown> = { actualizadoEn: nowIso() };
  if (req.body?.condicion !== undefined) {
    if (!isOfferCondition(req.body.condicion)) return fail(res, 'OFFER_CONDITION_INVALID', 'Selecciona una condición válida.', 400);
    patch['condicion'] = req.body.condicion;
  }
  ['skuFerreteria', 'codigoBarras', 'activo', 'publicado'].forEach((key) => {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  });
  if (req.body?.precio !== undefined) patch['precio'] = Math.max(0, numberValue(req.body.precio));
  if (req.body?.stock !== undefined) patch['stock'] = Math.max(0, Math.floor(numberValue(req.body.stock)));
  patch['incluyeIva'] = true;
  if (req.body?.unidadMedidaPrecio !== undefined) {
    const unit = normalizeText(req.body.unidadMedidaPrecio);
    patch['unidadMedidaPrecio'] = measurementUnits.includes(unit) ? unit : null;
  }
  if (req.body?.cantidadMedida !== undefined) {
    const quantity = numberValue(req.body.cantidadMedida, 0);
    patch['cantidadMedida'] = quantity > 0 ? quantity : null;
  }
  if (req.body?.vigenteDesde !== undefined) patch['vigenteDesde'] = optionalOfferDate(req.body.vigenteDesde);
  if (req.body?.vigenteHasta !== undefined) patch['vigenteHasta'] = optionalOfferDate(req.body.vigenteHasta);
  if (req.body?.condicionesOferta !== undefined) {
    patch['condicionesOferta'] = normalizeText(req.body.condicionesOferta).slice(0, 500);
  }
  if (req.authRole === 'admin' && req.body?.patrocinado !== undefined) {
    patch['patrocinado'] = req.body.patrocinado === true;
  }
  const updated = await patchRow(COLLECTIONS.storeProducts, req.params.offerId, patch);
  await createRow(COLLECTIONS.priceHistory, {
    ferreteriaId: req.params.storeId,
    productoFerreteriaId: req.params.offerId,
    productoMaestroId: existing.productoMaestroId,
    actorId: req.authUserId,
    action: 'updated',
    precioAnterior: numberValue(existing.precio),
    precioNuevo: numberValue(updated?.precio),
    incluyeIva: updated?.incluyeIva !== false,
    ocurridoEn: nowIso(),
    source: req.authRole === 'admin' ? 'admin' : 'ferreteria',
    snapshotAnterior: offerEvidence(existing),
    snapshotNuevo: offerEvidence(updated)
  });
  const product = await row(COLLECTIONS.masterProducts, existing.productoMaestroId);
  return ok(res, { ...updated, productoMaestro: product });
});

storeCatalogRouter.delete('/ferreterias/:storeId/catalogo/:offerId', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;

  const existing = await row(COLLECTIONS.storeProducts, req.params.offerId);
  if (!existing || existing.ferreteriaId !== req.params.storeId) {
    return fail(res, 'CATALOGO_NOT_FOUND', 'Producto de ferreteria no encontrado.', 404);
  }

  await createRow(COLLECTIONS.priceHistory, {
    ferreteriaId: req.params.storeId,
    productoFerreteriaId: req.params.offerId,
    productoMaestroId: existing.productoMaestroId,
    actorId: req.authUserId,
    action: 'deleted',
    precioAnterior: numberValue(existing.precio),
    precioNuevo: null,
    incluyeIva: existing.incluyeIva !== false,
    ocurridoEn: nowIso(),
    source: req.authRole === 'admin' ? 'admin' : 'ferreteria',
    snapshotAnterior: offerEvidence(existing),
    snapshotNuevo: null
  });
  await db.runTransaction(async tx=>{
    const offerRef=db.collection(COLLECTIONS.storeProducts).doc(req.params.offerId);
    const current=await tx.get(offerRef);
    if(!current.exists)return;
    if(existing.vehiculoDonanteId){
      const donorRef=db.collection(COLLECTIONS.donorVehicles).doc(existing.vehiculoDonanteId),donor=await tx.get(donorRef);
      if(donor.exists){const data=donor.data()!;tx.update(donorRef,{piezas:(data['piezas']||[]).map((p:any)=>p.id===existing.piezaDonanteId?{...p,ofertaId:null,estado:'borrador',seleccionada:false,fotosPublicacion:[]}:p),revision:Number(data['revision']||0)+1,actualizadoEn:nowIso()});}
    }
    tx.delete(offerRef);
  });
  const cleanup=await Promise.allSettled((existing.fotosPublicacion||[]).map((photo:any)=>deleteOfferImageFiles(photo)));
  if(cleanup.some(result=>result.status==='rejected'))console.error('OFFER_PHOTOS_DELETE_CLEANUP_FAILED');
  return ok(res, { deleted: true });
});

// Projects/cotizaciones.
