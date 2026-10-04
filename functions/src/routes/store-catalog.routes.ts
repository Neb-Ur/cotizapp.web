import { Router } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, row, createRow, patchRow } from '../repositories/firestore.repository.js';
import { canAccessOwner, requireStoreWriteAccess } from '../lib/ownership.js';
import { requireCurrentStoreAgreement } from '../services/store-agreement.service.js';
export const storeCatalogRouter = Router();

const measurementUnits = ['kg', 'l', 'm', 'm2', 'unidad'];

function optionalOfferDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  const products = await rows(COLLECTIONS.masterProducts);
  const productById = new Map(products.map((item) => [item.id, item]));
  const data = (await rows(COLLECTIONS.storeProducts))
    .filter((item) => item.ferreteriaId === req.params.storeId)
    .map((item) => ({ ...item, productoMaestro: productById.get(item.productoMaestroId) }))
    .filter((item) => !!item.productoMaestro);
  return ok(res, data);
});

storeCatalogRouter.post('/ferreterias/:storeId/catalogo', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  if (!(await requireCurrentStoreAgreement(req, res, req.params.storeId))) return;
  const masterId = normalizeText(req.body?.productoMaestroId);
  const product = await row(COLLECTIONS.masterProducts, masterId);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro indicado.', 404);
  const current = (await rows(COLLECTIONS.storeProducts)).find((item) => item.ferreteriaId === req.params.storeId && item.productoMaestroId === masterId);
  if (current) return fail(res, 'CATALOGO_ALREADY_LINKED', 'El producto ya esta vinculado en la ferreteria.', 409);
  const created = await createRow(COLLECTIONS.storeProducts, {
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
  });
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
    source: 'ferreteria'
  });
  return ok(res, { ...created, productoMaestro: product }, 201);
});

storeCatalogRouter.patch('/ferreterias/:storeId/catalogo/:offerId', requireAuth, requireRole('ferreteria', 'admin'), async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  if (!(await requireCurrentStoreAgreement(req, res, req.params.storeId))) return;
  const existing = await row(COLLECTIONS.storeProducts, req.params.offerId);
  if (!existing || existing.ferreteriaId !== req.params.storeId) return fail(res, 'CATALOGO_NOT_FOUND', 'Producto de ferreteria no encontrado.', 404);
  const patch: Record<string, unknown> = { actualizadoEn: nowIso() };
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
    source: req.authRole === 'admin' ? 'admin' : 'ferreteria'
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
    source: req.authRole === 'admin' ? 'admin' : 'ferreteria'
  });
  await db.collection(COLLECTIONS.storeProducts).doc(req.params.offerId).delete();
  return ok(res, { deleted: true });
});

// Projects/cotizaciones.
